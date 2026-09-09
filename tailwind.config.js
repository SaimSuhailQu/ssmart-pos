/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Enterprise Neutral Palette (Zinc / Slate foundations)
        canvas: {
          DEFAULT: '#090d16',
          subtle: '#0f172a',
          card: '#131b2e',
          elevated: '#1a243b',
          border: '#1e293b',
          hover: '#24304c',
        },
        // Primary Brand & System Accent (Trustworthy Deep Indigo / Slate Blue)
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#6366f1',
        },
        // Semantic Financial & Operations Tokens
        status: {
          emerald: {
            DEFAULT: '#10b981',
            light: '#d1fae5',
            dark: '#047857',
            bg: 'rgba(16, 185, 129, 0.12)',
            border: 'rgba(16, 185, 129, 0.28)',
          },
          amber: {
            DEFAULT: '#f59e0b',
            light: '#fef3c7',
            dark: '#b45309',
            bg: 'rgba(245, 158, 11, 0.12)',
            border: 'rgba(245, 158, 11, 0.28)',
          },
          coral: {
            DEFAULT: '#f43f5e',
            light: '#ffe4e6',
            dark: '#be123c',
            bg: 'rgba(244, 63, 94, 0.12)',
            border: 'rgba(244, 63, 94, 0.28)',
          },
          slate: {
            DEFAULT: '#64748b',
            light: '#f1f5f9',
            dark: '#334155',
            bg: 'rgba(100, 116, 139, 0.12)',
            border: 'rgba(100, 116, 139, 0.28)',
          }
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
