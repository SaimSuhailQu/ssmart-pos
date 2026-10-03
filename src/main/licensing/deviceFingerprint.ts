/**
 * Hardened device fingerprint (main process).
 *
 * Combines the strongest stable machine identifier the OS offers:
 *  - Windows: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid (registry)
 *  - macOS:   IOPlatformUUID via ioreg
 *  - Linux:   /etc/machine-id (fallback: /var/lib/dbus/machine-id)
 *  - Fallback: hostname | OS user | install UUID (previous behavior)
 *
 * The fingerprint is SHA-256("ssmart-pos:v2:" + identifiers). It is a
 * one-way hash: nothing recoverable about the machine leaves the device.
 * Reinstalling the app does not change it; reinstalling the OS does
 * (documented — the reseller re-issues the license in that case).
 */

import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { hostname, userInfo } from 'os';
import { join } from 'path';
import { app } from 'electron';
import { createLogger } from '../../core/logger';

const log = createLogger('licensing:fingerprint');

function windowsMachineGuid(): string | null {
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 },
    );
    const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
    return m ? m[1].trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

function macPlatformUuid(): string | null {
  try {
    const out = execSync('ioreg -d2 -c IOPlatformExpertDevice -a', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    return m ? m[1].trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

function linuxMachineId(): string | null {
  for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
    try {
      if (existsSync(p)) {
        const v = readFileSync(p, 'utf8').trim().toLowerCase();
        if (/^[0-9a-f]{16,64}$/.test(v)) return v;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function installUuid(): string {
  try {
    const file = join(app.getPath('userData'), 'device-uuid.txt');
    if (existsSync(file)) {
      const existing = readFileSync(file, 'utf8').trim();
      if (existing.length >= 8) return existing;
    }
    const fresh = randomUUID();
    writeFileSync(file, fresh, 'utf8');
    return fresh;
  } catch {
    return randomUUID();
  }
}

/** Raw machine identity material (pre-hash). Never leaves the device. */
export function machineIdentityMaterial(): string {
  let hardwareId: string | null = null;
  try {
    if (process.platform === 'win32') hardwareId = windowsMachineGuid();
    else if (process.platform === 'darwin') hardwareId = macPlatformUuid();
    else if (process.platform === 'linux') hardwareId = linuxMachineId();
  } catch (e) {
    log.warn('hardware id lookup failed, using fallback', { error: String(e) });
  }

  let user = 'unknown-user';
  try {
    user = userInfo().username;
  } catch {
    /* ignore */
  }

  const parts = [hardwareId ?? 'no-hwid', hostname(), user, installUuid()];
  return parts.join('|');
}

/** Stable one-way device fingerprint, hex SHA-256. */
export function computeFingerprint(): string {
  return createHash('sha256').update(`ssmart-pos:v2:${machineIdentityMaterial()}`).digest('hex');
}

/**
 * Short device code shown to the buyer for manual activation.
 * Groups of 4 for readability: `a1b2-c3d4-e5f6`.
 */
export function deviceCode(fingerprint?: string): string {
  const fp = (fingerprint ?? computeFingerprint()).replace(/[^0-9a-f]/gi, '').slice(0, 12);
  return `${fp.slice(0, 4)}-${fp.slice(4, 8)}-${fp.slice(8, 12)}`.toLowerCase();
}
