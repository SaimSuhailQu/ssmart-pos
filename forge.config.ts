import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
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
    packageAfterCopy: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      console.log(`[Forge Hook] Preparing buildPath for npm install: ${buildPath}`);
      
      // Ensure the node_modules folder exists
      fs.mkdirSync(path.join(buildPath, 'node_modules'), { recursive: true });
      
      // Copy package.json and package-lock.json from root to the temporary packaging folder
      const rootDir = __dirname;
      fs.copyFileSync(path.resolve(rootDir, 'package.json'), path.join(buildPath, 'package.json'));
      if (fs.existsSync(path.resolve(rootDir, 'package-lock.json'))) {
        fs.copyFileSync(path.resolve(rootDir, 'package-lock.json'), path.join(buildPath, 'package-lock.json'));
      }
      
      console.log(`[Forge Hook] Installing production dependencies in: ${buildPath}`);
      execSync('npm install --omit=dev --no-audit --no-fund', {
        cwd: buildPath,
        stdio: 'inherit',
      });
    },
  },
};

export default config;
