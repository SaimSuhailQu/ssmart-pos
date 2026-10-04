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
        // ------------------------------------------------------------------
        // EXECUTIVE DARK theme (matches the Flutter admin app "Option A").
        // Deep navy surfaces, champagne-gold accents, warm off-white text.
        // ------------------------------------------------------------------
        canvas: {
          DEFAULT: '#0A0E1A', // executive navyDeep
          subtle: '#0D1226',
          card: '#141B31',    // executive navyCard
          elevated: '#1D2542',
          border: '#232A45',
          hover: '#2A3352',
        },
        // Text content scale (matches the --text-* variables in index.css)
        content: {
          primary: '#F5F1E6',   // warm off-white headings, key figures
          secondary: '#D8D3C3', // body copy
          muted: '#9AA3B8',     // labels, captions
          faint: '#5B6376',     // disabled, decorative
        },
        // Primary Brand & System Accent — champagne gold (executive).
        // `brand` is the semantic "primary accent" token: components that
        // used it for the old indigo accent now render executive gold.
        brand: {
          50: '#FBF7EC',
          100: '#F5ECD6',
          200: '#EAD9AC',
          300: '#DEC184',
          400: '#D4AF6E',
          500: '#C9A96A',
          600: '#A98850',
          700: '#8A6D3B',
          800: '#6E562F',
          900: '#544226',
          DEFAULT: '#C9A96A',
        },
        // Champagne gold scale under its semantic name for new code.
        gold: {
          50: '#FBF7EC',
          100: '#F5ECD6',
          200: '#EAD9AC',
          300: '#DEC184',
          400: '#D4AF6E',
          500: '#C9A96A',
          600: '#A98850',
          700: '#8A6D3B',
          800: '#6E562F',
          900: '#544226',
          DEFAULT: '#C9A96A',
          light: '#E8C87A',
          deep: '#8A6D3B',
        },
        // EXECUTIVE RE-THEME: the `indigo` scale is remapped to champagne
        // gold. ~80 existing `indigo-*` utilities (buttons, focus rings,
        // highlights) were written against indigo as "the primary accent";
        // remapping here re-themes them all to executive gold without
        // touching every call site. New code should use `gold-*`/`brand-*`.
        indigo: {
          50: '#FBF7EC',
          100: '#F5ECD6',
          200: '#EAD9AC',
          300: '#DEC184',
          400: '#D4AF6E',
          500: '#C9A96A',
          600: '#A98850',
          700: '#8A6D3B',
          800: '#6E562F',
          900: '#544226',
          950: '#3A2F1D',
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
        // Executive display serif — hero numerals / till totals (Playfair Display).
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
