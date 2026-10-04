/**
 * Licensing IPC — wire into the main process with one call.
 *
 * In src/main.ts (inside app.whenReady, near the other handlers):
 *
 *   import { registerLicensingIpc } from './main/licensing/ipc';
 *   registerLicensingIpc();
 *
 * Preload additions (src/preload.ts):
 *
 *   activateProductKey: (key: string) => ipcRenderer.invoke('license:activate-key', key),
 *   getDeviceCode: () => ipcRenderer.invoke('license:get-device-code'),
 *   deactivateProductKey: () => ipcRenderer.invoke('license:deactivate-key'),
 *
 * The existing 'get-license-state' / 'get-device-fingerprint' handlers
 * should delegate to evaluateLicense() for the unified tiered result —
 * see UPGRADE_NOTES below.
 */

import { ipcMain } from 'electron';
import {
  activateProductKey,
  claimPendingBinding,
  deactivateProductKey,
  evaluateLicense,
  getDeviceCode,
  TieredLicenseState,
} from './licenseManager';
import {
  cachedGoogleEmail,
  getUsableSession,
  googleSignIn,
  googleSignOut,
  setActiveSession,
} from './googleAuth';
import { createLogger } from '../../core/logger';

const log = createLogger('licensing:ipc');

/**
 * Register the licensing IPC handlers.
 *
 * @param onChanged optional hook the main process provides so a successful
 *   activation / deactivation immediately refreshes the cached license state
 *   (and pushes it to the renderer), instead of waiting for the next
 *   12-hour revalidation cycle.
 */
export function registerLicensingIpc(
  onChanged?: (state: TieredLicenseState) => void,
): void {
  const notify = async () => {
    if (!onChanged) return;
    try {
      onChanged(await evaluateLicense());
    } catch (e) {
      log.warn('post-change license re-evaluation failed', {
        error: String(e),
      });
    }
  };

  ipcMain.handle('license:get-state', async () => {
    try {
      return await evaluateLicense();
    } catch (e) {
      log.error('license:get-state failed', { error: String(e) });
      throw e;
    }
  });

  ipcMain.handle('license:activate-key', async (_event, key: string) => {
    if (typeof key !== 'string' || key.trim().length < 16) {
      throw new Error('Enter the full product key.');
    }
    // Claim the server device binding if the user signed in with Google
    // (fresh interactive session, else silent refresh). Offline → the key
    // still activates; binding is claimed on next sign-in.
    let session = null;
    try {
      session = await getUsableSession();
    } catch {
      session = null;
    }
    const res = await activateProductKey(key, session);
    if (!res.ok) throw res.error;
    await notify();
    return res.value;
  });

  ipcMain.handle('license:get-device-code', () => getDeviceCode());

  ipcMain.handle('license:deactivate-key', async () => {
    await deactivateProductKey();
    await notify();
    return true;
  });

  // --- Google sign-in + device binding ---------------------------------

  ipcMain.handle('license:google-signin', async () => {
    const res = await googleSignIn();
    if (!res.ok) throw res.error;
    setActiveSession(res.value);
    // Bind any already-activated (offline) key to this Google account.
    let boundState: TieredLicenseState | null = null;
    try {
      const claim = await claimPendingBinding(res.value);
      if (claim.ok) boundState = claim.value;
    } catch (e) {
      log.warn('pending binding claim failed', { error: String(e) });
    }
    await notify();
    return { email: res.value.email, boundState };
  });

  ipcMain.handle('license:google-signout', async () => {
    setActiveSession(null);
    googleSignOut();
    await notify();
    return true;
  });

  ipcMain.handle('license:google-user', () => {
    return cachedGoogleEmail();
  });
}

/**
 * UPGRADE_NOTES — migrating the existing handlers in src/main.ts:
 *
 * Replace:
 *   ipcMain.handle('get-license-state', () => checkLicense());
 * With:
 *   ipcMain.handle('get-license-state', () => evaluateLicense());
 *   (import { evaluateLicense } from './main/licensing/licenseManager')
 *
 * This keeps the renderer's window.api.getLicenseState() contract
 * identical while adding offline-key + tier + grace evaluation.
 */
