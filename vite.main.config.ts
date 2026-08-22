import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  // Load .env files so that VITE_* variables are available in the main process
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'escpos', 'escpos-usb', 'usb', /^usb\/.*/]
      }
    },
    define: {
      // Inject VITE_ env vars as import.meta.env.VITE_* string constants
      ...Object.fromEntries(
        Object.entries(env).map(([key, val]) => [`import.meta.env.${key}`, JSON.stringify(val)])
      ),
    },
  };
});
