/**
 * Google OAuth for the Electron main process (device binding).
 *
 * Desktop-app loopback flow:
 *  1. Spin up a one-shot HTTP server on 127.0.0.1 (ephemeral port).
 *  2. Open a BrowserWindow at Google's OAuth consent page with
 *     redirect_uri=http://127.0.0.1:<port>/callback.
 *  3. Google redirects back with ?code=… — capture it, close the window.
 *  4. Exchange the code for tokens (id_token + refresh_token).
 *
 * The returned id_token is what Firebase Auth consumes via
 * signInWithCredential(GoogleAuthProvider.credential(idToken)) — Google's
 * servers verify it, so the email/uid we get back are trustworthy.
 *
 * Setup (one time, by the reseller):
 *  - Google Cloud Console → APIs & Services → Credentials → Create
 *    "OAuth client ID" → Application type "Desktop app".
 *  - Bake the client ID into the build as VITE_GOOGLE_OAUTH_CLIENT_ID
 *    (or SSPOS_GOOGLE_OAUTH_CLIENT_ID env at runtime).
 */

import { BrowserWindow } from 'electron';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { createLogger } from '../../core/logger';
import { computeFingerprint } from './deviceFingerprint';
import {
  deleteSecureCache,
  okOrNull,
  readSecureCache,
  writeSecureCache,
} from './secureCache';
import { err, ok, Result } from '../../core/result';

const log = createLogger('licensing:google-auth');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SESSION_CACHE = 'google-session.bin';
const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export interface GoogleSession {
  email: string;
  /** Google id_token (JWT). Short-lived (~1h). */
  idToken: string;
  /** Long-lived; stored encrypted, used for silent re-auth. */
  refreshToken: string;
  /** Epoch ms when the id_token expires. */
  idTokenExpiresAt: number;
}

interface StoredSession {
  email: string;
  refreshToken: string;
}

/** Resolve the OAuth client ID from build-time or runtime config. */
export function resolveGoogleClientId(): string | null {
  try {
    const vite = (import.meta as unknown as { env?: Record<string, string> }).env
      ?.VITE_GOOGLE_OAUTH_CLIENT_ID;
    if (vite && vite.length > 10) return vite;
  } catch {
    /* not bundled with vite env */
  }
  const env = process.env.SSPOS_GOOGLE_OAUTH_CLIENT_ID;
  return env && env.length > 10 ? env : null;
}

/** Decode the JWT payload (no signature check — display only). */
function decodeIdTokenEmail(idToken: string): string | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { email?: string; exp?: number };
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

function idTokenExpiry(idToken: string): number {
  try {
    const parts = idToken.split('.');
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 3600_000;
  } catch {
    return Date.now() + 3600_000;
  }
}

async function exchangeCode(
  clientId: string,
  code: string,
  redirectUri: string,
): Promise<{ idToken: string; refreshToken: string }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 120)}`);
  }
  const json = (await res.json()) as {
    id_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (!json.id_token) throw new Error('Google did not return an ID token.');
  return { idToken: json.id_token, refreshToken: json.refresh_token ?? '' };
}

async function refreshIdToken(
  clientId: string,
  refreshToken: string,
): Promise<{ idToken: string; refreshToken: string }> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}).`);
  const json = (await res.json()) as { id_token?: string; refresh_token?: string };
  if (!json.id_token) throw new Error('Google did not return an ID token.');
  return { idToken: json.id_token, refreshToken: json.refresh_token ?? refreshToken };
}

/**
 * Interactive Google sign-in. Opens the consent page; resolves with the
 * session (email + tokens). The refresh token is persisted encrypted so
 * future launches can re-auth silently.
 */
export async function googleSignIn(): Promise<Result<GoogleSession>> {
  const clientId = resolveGoogleClientId();
  if (!clientId) {
    return err(
      new Error(
        'Google sign-in is not configured in this build (missing OAuth client ID). Contact support.',
      ),
    );
  }

  // Holder (not bare locals): assignments happen inside the Promise
  // executor closure, which defeats TS's flow narrowing on plain `let`s.
  const refs: { server: Server | null; authWin: BrowserWindow | null } = {
    server: null,
    authWin: null,
  };
  try {
    const code: string = await new Promise((resolve, reject) => {
      refs.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1');
          if (url.pathname !== '/callback') {
            res.writeHead(404).end();
            return;
          }
          const errParam = url.searchParams.get('error');
          const got = url.searchParams.get('code');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(
            errParam
              ? '<h2>Sign-in cancelled</h2><p>You can close this window.</p>'
              : '<h2>Signed in</h2><p>You can close this window and return to SSmart POS.</p>',
          );
          if (errParam || !got) reject(new Error(errParam ?? 'No authorization code returned.'));
          else resolve(got);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
      refs.server.listen(0, '127.0.0.1', () => {
        const port = (refs.server!.address() as AddressInfo).port;
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          access_type: 'offline',
          prompt: 'consent',
        });
        refs.authWin = new BrowserWindow({
          width: 480,
          height: 640,
          title: 'Sign in with Google',
          autoHideMenuBar: true,
          webPreferences: { nodeIntegration: false, contextIsolation: true },
        });
        refs.authWin.on('closed', () => reject(new Error('Sign-in window closed.')));
        void refs.authWin.loadURL(`${GOOGLE_AUTH_URL}?${params.toString()}`);
        // Stash for the token exchange after the promise resolves.
        (refs.server as unknown as { __redirectUri?: string }).__redirectUri = redirectUri;
      });
      refs.server.on('error', reject);
    });

    const redirectUri =
      (refs.server as unknown as { __redirectUri?: string } | null)?.__redirectUri ?? '';
    const { idToken, refreshToken } = await exchangeCode(clientId, code, redirectUri);
    const email = decodeIdTokenEmail(idToken);
    if (!email) throw new Error('Google did not return an email address.');

    const fingerprint = computeFingerprint();
    if (refreshToken) {
      writeSecureCache(SESSION_CACHE, fingerprint, {
        email,
        refreshToken,
      } satisfies StoredSession);
    }
    log.info('google sign-in complete', { email });
    return ok({
      email,
      idToken,
      refreshToken,
      idTokenExpiresAt: idTokenExpiry(idToken),
    });
  } catch (e) {
    log.warn('google sign-in failed', { error: String(e) });
    return err(e instanceof Error ? e : new Error(String(e)));
  } finally {
    try {
      refs.authWin?.close();
    } catch {
      /* ignore */
    }
    try {
      refs.server?.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Silent re-auth on launch using the stored refresh token.
 * Returns null when there is no stored session or the network fails —
 * callers must treat that as "stay on the local license state" (offline).
 */
export async function googleSilentAuth(): Promise<GoogleSession | null> {
  const clientId = resolveGoogleClientId();
  if (!clientId) return null;
  const fingerprint = computeFingerprint();
  const stored = okOrNull(readSecureCache<StoredSession>(SESSION_CACHE, fingerprint));
  if (!stored?.refreshToken) return null;
  try {
    const { idToken, refreshToken } = await refreshIdToken(clientId, stored.refreshToken);
    const email = decodeIdTokenEmail(idToken) ?? stored.email;
    writeSecureCache(SESSION_CACHE, fingerprint, {
      email,
      refreshToken,
    } satisfies StoredSession);
    return { email, idToken, refreshToken, idTokenExpiresAt: idTokenExpiry(idToken) };
  } catch (e) {
    log.warn('google silent auth failed (offline?)', { error: String(e) });
    return null;
  }
}

/** Forget the stored Google session (sign out / deactivate). */
export function googleSignOut(): void {
  try {
    deleteSecureCache(SESSION_CACHE);
  } catch {
    /* ignore */
  }
}

/** The cached Google email, if this device ever signed in. */
export function cachedGoogleEmail(): string | null {
  const fingerprint = computeFingerprint();
  return okOrNull(readSecureCache<StoredSession>(SESSION_CACHE, fingerprint))?.email ?? null;
}

export function isGoogleSessionFresh(session: GoogleSession): boolean {
  return session.idTokenExpiresAt - Date.now() > REFRESH_SKEW_MS;
}

// --- In-memory active session -------------------------------------------
// Holds the most recent interactive sign-in so a product-key activation
// seconds later can claim the device binding without another consent page.

let activeSession: GoogleSession | null = null;

export function setActiveSession(session: GoogleSession | null): void {
  activeSession = session;
}

/** Fresh interactive session, else a silent refresh via stored token. */
export async function getUsableSession(): Promise<GoogleSession | null> {
  if (activeSession && isGoogleSessionFresh(activeSession)) return activeSession;
  const silent = await googleSilentAuth();
  if (silent) activeSession = silent;
  return silent;
}
