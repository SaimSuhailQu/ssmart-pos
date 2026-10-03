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
  deactivateProductKey,
  evaluateLicense,
  getDeviceCode,
  TieredLicenseState,
} from './licenseManager';
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
    const res = activateProductKey(key);
    if (!res.ok) throw res.error;
    await notify();
    return res.value;
  });

  ipcMain.handle('license:get-device-code', () => getDeviceCode());

  ipcMain.handle('license:deactivate-key', async () => {
    deactivateProductKey();
    await notify();
    return true;
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
