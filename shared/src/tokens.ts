/**
 * VaiCar Design System Tokens
 * Source of truth for brand colors, typography, spacing and styling.
 * Preserves the authentic VaiCar green/nature & modern Atlantic forest identity.
 */

export const colors = {
  brand: {
    primary: '#16A34A',      // VaiCar Green (Emerald / Forest 600)
    primaryHover: '#15803D', // Hover / Dark 700
    primaryActive: '#166534',// Active 800
    bright: '#22C55E',       // Active/Online indicator 500
    light: '#DCFCE7',        // Light tint 100
    soft: '#F0FDF4',         // Very soft tint 50
    deep: '#14532D',         // Deep contrast text 900
    yellow: '#FACC15',       // Warning / Attention 400
    yellowDark: '#CA8A04',   // Warning contrast 600
  },
  status: {
    online: '#22C55E',       // Online driver
    offline: '#64748B',      // Offline
    requested: '#3B82F6',    // Requested ride (blue)
    accepted: '#EAB308',     // Driver heading over (yellow)
    arrived: '#F97316',      // Arrived at pickup (orange)
    inProgress: '#10B981',   // In transit (green)
    completed: '#16A34A',    // Successfully finished
    cancelled: '#EF4444',    // Cancelled
    error: '#EF4444',
    errorLight: '#FEE2E2',
    success: '#10B981',
    successLight: '#D1FAE5',
  },
  dark: {
    bg: '#020617',          // slate-950
    card: '#0F172A',        // slate-900
    cardHover: '#1E293B',   // slate-800
    border: '#334155',      // slate-700
    borderSubtle: '#1E293B',
    text: '#F8FAFC',        // slate-50
    textMuted: '#94A3B8',   // slate-400
  },
  light: {
    bg: '#F8FAFC',          // slate-50
    surface: '#FFFFFF',
    border: '#E2E8F0',      // slate-200
    text: '#0F172A',        // slate-900
    textMuted: '#64748B',   // slate-500
  }
} as const;

export const typography = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  }
} as const;

export const radius = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  card: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  glow: '0 0 15px -3px rgba(22, 163, 74, 0.4)',
  glowBright: '0 0 20px -2px rgba(34, 197, 94, 0.5)',
} as const;

export const zones = [
  'Centro & Porto Grande',
  'Topolândia & Itatinga',
  'Barequeçaba & Pitangueiras',
  'Maresias & Paúba',
  'Boiçucanga',
  'Cambury & Camburizinho',
  'Baleia & Barra do Sahy',
  'Juquehy',
  'Barra do Una & Boracéia',
  'Costa Norte (Enseada, Canto do Mar, Cigarras)'
] as const;

export type ZoneName = typeof zones[number];
