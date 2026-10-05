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
        // NOIR GRAPHITE theme (matches the Flutter admin app "Option K").
        // True monochrome: platinum on pure black. No color — bold type and
        // hairlines do the talking. Supersedes Executive Dark (2026-10-05).
        // ------------------------------------------------------------------
        canvas: {
          DEFAULT: '#0A0A0B', // graphite deep
          subtle: '#0D0D0F',
          card: '#141416',    // graphite card
          elevated: '#1B1B1E',
          border: '#26262A',
          hover: '#2A2A2E',
        },
        // Text content scale (matches the --text-* variables in index.css)
        content: {
          primary: '#F5F5F4',   // near-white headings, key figures
          secondary: '#D8D8D6', // body copy
          muted: '#8E8E93',     // labels, captions
          faint: '#6E6E72',     // disabled, decorative
        },
        // Primary Brand & System Accent — platinum (graphite).
        // `brand` is the semantic "primary accent" token: components that
        // used it for the old gold accent now render platinum.
        brand: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#EDEDEA',
          300: '#D8D8D6',
          400: '#B9B9BE',
          500: '#8E8E93',
          600: '#6E6E72',
          700: '#52525B',
          800: '#3F3F46',
          900: '#27272A',
          DEFAULT: '#EDEDEA',
        },
        // Platinum scale under its semantic name for new code.
        platinum: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#EDEDEA',
          300: '#D8D8D6',
          400: '#B9B9BE',
          500: '#8E8E93',
          600: '#6E6E72',
          700: '#52525B',
          800: '#3F3F46',
          900: '#27272A',
          DEFAULT: '#EDEDEA',
          light: '#FFFFFF',
          deep: '#8E8E93',
        },
        // GRAPHITE RE-THEME: the `indigo` scale is remapped to platinum.
        // ~80 existing `indigo-*` utilities (buttons, focus rings,
        // highlights) were written against indigo as "the primary accent";
        // remapping here re-themes them all to platinum without
        // touching every call site. New code should use
        // `platinum-*`/`brand-*`.
        indigo: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#EDEDEA',
          300: '#D8D8D6',
          400: '#B9B9BE',
          500: '#8E8E93',
          600: '#6E6E72',
          700: '#52525B',
          800: '#3F3F46',
          900: '#27272A',
          950: '#1C1C1F',
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
        // Graphite display serif — bold hero numerals / till totals (Playfair Display).
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        // Bold is the brand — display numerals/headings are extrabold.
      },
    },
  },
  plugins: [],
}
