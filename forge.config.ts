import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: path.resolve(__dirname, 'assets/icon'),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      setupIcon: path.resolve(__dirname, 'assets/icon.ico'),
      iconUrl: 'https://raw.githubusercontent.com/electron/electron/master/shell/browser/resources/win/electron.ico',
    }),
    new MakerZIP({}, ['win32', 'darwin', 'linux']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'SaimSuhailQu',
          name: 'ssmart-pos',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {

      console.log(`[Forge Hook] Preparing buildPath for npm install: ${buildPath}`);

      // Ensure the node_modules folder exists
      fs.mkdirSync(path.join(buildPath, 'node_modules'), { recursive: true });

      // Copy package.json and package-lock.json from root to the temporary packaging folder
      const rootDir = __dirname;
      fs.copyFileSync(path.resolve(rootDir, 'package.json'), path.join(buildPath, 'package.json'));
      if (fs.existsSync(path.resolve(rootDir, 'package-lock.json'))) {
        fs.copyFileSync(path.resolve(rootDir, 'package-lock.json'), path.join(buildPath, 'package-lock.json'));
      }

      // Copy assets folder (containing icon.ico, icon.png, etc.) so packaged executable can resolve window icon
      const assetsSrc = path.resolve(rootDir, 'assets');
      const assetsDest = path.join(buildPath, 'assets');
      if (fs.existsSync(assetsSrc)) {
        fs.cpSync(assetsSrc, assetsDest, { recursive: true });
      }

      console.log(`[Forge Hook] Installing production dependencies in: ${buildPath}`);
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      execSync(`${npmCmd} install --omit=dev --no-audit --no-fund`, {
        cwd: buildPath,
        stdio: 'inherit',
      });
    },
  },
};

export default config;
