import { autoUpdater, app, dialog, BrowserWindow } from 'electron';

// GitHub Repository details for releases
const GITHUB_OWNER = 'SaimSuhailQu';
const GITHUB_REPO = 'ssmart-pos';

export function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  // In development, autoUpdater is not active because Squirrel requires packaged installs
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Skipped: App is running in development mode.');
    return;
  }

  // Windows Squirrel update feed URL pointing to GitHub releases via update.electronjs.org or direct GitHub raw/releases
  // For standard Squirrel.Windows with GitHub releases:
  // update.electronjs.org provides a free instant update server for open GitHub repos!
  // Format: https://update.electronjs.org/:owner/:repo/:platform-:arch/:version
  const updateServerUrl = `https://update.electronjs.org/${GITHUB_OWNER}/${GITHUB_REPO}/${process.platform}-${process.arch}/${app.getVersion()}`;

  try {
    console.log(`[AutoUpdater] Setting feed URL: ${updateServerUrl}`);
    autoUpdater.setFeedURL({
      url: updateServerUrl,
      headers: {
        'User-Agent': `${app.getName()}/${app.getVersion()} (${process.platform}; ${process.arch})`,
      },
    });

    // AutoUpdater Event Listeners
    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-status', { status: 'checking' });
      }
    });

    autoUpdater.on('update-available', () => {
      console.log('[AutoUpdater] New update found! Downloading in background...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-status', { status: 'available' });
      }
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[AutoUpdater] App is up to date.');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-status', { status: 'up-to-date' });
      }
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater] Error checking/downloading update:', err?.message || err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-status', { status: 'error', error: err?.message });
      }
    });

    autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName) => {
      console.log('[AutoUpdater] Update downloaded:', releaseName);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-status', { 
          status: 'downloaded', 
          version: releaseName, 
          releaseNotes 
        });
      }

      // Prompt the user to restart now or on next launch
      dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart and Update Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Ready to Install',
        message: `A new version of MART POS (${releaseName || 'latest'}) has been downloaded.`,
        detail: 'Would you like to restart the application now to apply the update? Your database and data will remain intact.',
      }).then((returnValue) => {
        if (returnValue.response === 0) {
          // Restart and apply update
          autoUpdater.quitAndInstall();
        }
      });
    });

    // Initial check after 15 seconds to avoid slowing down startup
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdates();
      } catch (err) {
        console.warn('[AutoUpdater] Initial check error:', err);
      }
    }, 15000);

    // Periodic check every 4 hours
    setInterval(() => {
      try {
        autoUpdater.checkForUpdates();
      } catch (err) {
        console.warn('[AutoUpdater] Interval check error:', err);
      }
    }, 4 * 60 * 60 * 1000);

  } catch (error) {
    console.error('[AutoUpdater] Failed to initialize auto-updater:', error);
  }
}

export function checkForUpdatesManual() {
  if (!app.isPackaged) {
    return { success: false, message: 'App is running in development mode.' };
  }
  try {
    autoUpdater.checkForUpdates();
    return { success: true, message: 'Checking for updates...' };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMessage || 'Failed to check for updates.' };
  }
}

export function quitAndInstallUpdate() {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall();
  }
}
