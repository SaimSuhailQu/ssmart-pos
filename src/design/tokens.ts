/**
 * Design tokens — the contract behind the visual system.
 *
 * These tokens mirror `tailwind.config.js` (canvas/content/brand/status)
 * and extend it with the non-color scales Tailwind can't express well:
 * spacing (4/8pt grid), radii, elevation, motion, and touch targets.
 *
 * NOIR GRAPHITE theme (platinum on true black — matches the Flutter admin
 * app "Option K refined"): the `brand` scale and the `indigo` utilities are
 * remapped to platinum in tailwind.config.js, so `brand-*` and the ~80 legacy
 * `indigo-*` call sites all render graphite platinum. New code should prefer
 * the semantic `platinum-*` / `brand-*` tokens over raw `indigo-*`.
 * Bold is the brand: display numerals and headings render extrabold
 * (see `.font-display` in index.css).
 *
 * Rules for components:
 *  - Spacing: use multiples of 4 (8 for section rhythm). Never 3px/5px/7px.
 *  - Touch targets: interactive elements are >= 48×48dp (`touch.min`).
 *  - Radii: sm=6 md=10 lg=16 xl=24. Cards lg, buttons md, chips sm.
 *  - Motion: 120ms micro (press), 200ms UI (modal/drawer), ease-out.
 *  - zIndex: keep overlays in the scale below — no ad-hoc z-[9999].
 */

export const spacing = {
  px: 1,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const elevation = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.35)',
  md: '0 4px 12px rgba(0,0,0,0.4)',
  lg: '0 12px 32px rgba(0,0,0,0.5)',
  popover: '0 16px 48px rgba(0,0,0,0.55)',
} as const;

export const motion = {
  micro: 120, // press / active-state feedback
  ui: 200, // modal, drawer, dropdown
  page: 280, // view transitions
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const touch = {
  /** Minimum interactive target — WCAG 2.2 AA / Material guidance. */
  min: 48,
  /** Comfortable target for primary POS actions (tender, numpad). */
  comfortable: 56,
} as const;

export const zIndex = {
  content: 0,
  stickyBar: 10,
  dropdown: 40,
  drawer: 50,
  modal: 60,
  toast: 80,
  licenseGate: 100,
} as const;

/** Semantic intent → tailwind status token suffix. Single mapping point. */
export const intent = {
  success: 'status-emerald',
  warning: 'status-amber',
  danger: 'status-coral',
  info: 'brand',
  neutral: 'status-slate',
} as const;

export type Intent = keyof typeof intent;

/**
 * Typography scale tuned for glanceable POS data.
 * Display: till totals. Title: section headers. Body: rows. Caption: meta.
 */
export const typeScale = {
  display: { size: 40, weight: 800, tracking: '-0.02em', lineHeight: 1.1 },
  tillTotal: { size: 32, weight: 800, tracking: '-0.01em', lineHeight: 1.15 },
  title: { size: 20, weight: 700, tracking: '0', lineHeight: 1.3 },
  subtitle: { size: 14, weight: 600, tracking: '0', lineHeight: 1.4 },
  body: { size: 14, weight: 500, tracking: '0', lineHeight: 1.5 },
  caption: { size: 12, weight: 500, tracking: '0', lineHeight: 1.4 },
  overline: { size: 10, weight: 700, tracking: '0.08em', lineHeight: 1.4 },
  mono: { size: 12, weight: 500, tracking: '0', lineHeight: 1.5 },
} as const;
