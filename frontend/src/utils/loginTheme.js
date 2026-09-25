/**
 * Login Page Theme Configuration
 * Defines the 8 predefined color themes for company login screens and helpers.
 */

export const LOGIN_COLOR_THEMES = [
  {
    id: 'orange',
    name: 'Innoveity Orange',
    primaryColor: '#F97316',
    hoverColor: '#EA580C',
    accentColor: '#EA580C',
    rgb: '249, 115, 22',
    hoverRgb: '234, 88, 12',
    buttonColor: 'bg-orange-500 text-white',
    cardBorder: 'border-orange-500/50'
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    primaryColor: '#10B981',
    hoverColor: '#059669',
    accentColor: '#059669',
    rgb: '16, 185, 129',
    hoverRgb: '5, 150, 105',
    buttonColor: 'bg-emerald-600 text-white',
    cardBorder: 'border-emerald-500/50'
  },
  {
    id: 'blue',
    name: 'Royal Blue',
    primaryColor: '#2563EB',
    hoverColor: '#1D4ED8',
    accentColor: '#1D4ED8',
    rgb: '37, 99, 235',
    hoverRgb: '29, 78, 216',
    buttonColor: 'bg-blue-600 text-white',
    cardBorder: 'border-blue-500/50'
  },
  {
    id: 'purple',
    name: 'Modern Violet',
    primaryColor: '#8B5CF6',
    hoverColor: '#7C3AED',
    accentColor: '#7C3AED',
    rgb: '139, 92, 246',
    hoverRgb: '124, 58, 237',
    buttonColor: 'bg-purple-600 text-white',
    cardBorder: 'border-purple-500/50'
  },
  {
    id: 'rose',
    name: 'Rose Red',
    primaryColor: '#F43F5E',
    hoverColor: '#E11D48',
    accentColor: '#E11D48',
    rgb: '244, 63, 94',
    hoverRgb: '225, 29, 72',
    buttonColor: 'bg-rose-600 text-white',
    cardBorder: 'border-rose-500/50'
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    primaryColor: '#D97706',
    hoverColor: '#B45309',
    accentColor: '#B45309',
    rgb: '217, 119, 6',
    hoverRgb: '180, 83, 9',
    buttonColor: 'bg-amber-600 text-white',
    cardBorder: 'border-amber-500/50'
  },
  {
    id: 'cyan',
    name: 'Deep Cyan',
    primaryColor: '#06B6D4',
    hoverColor: '#0891B2',
    accentColor: '#0891B2',
    rgb: '6, 182, 212',
    hoverRgb: '8, 145, 178',
    buttonColor: 'bg-cyan-600 text-white',
    cardBorder: 'border-cyan-500/50'
  },
  {
    id: 'slate',
    name: 'Charcoal Slate',
    primaryColor: '#334155',
    hoverColor: '#1E293B',
    accentColor: '#1E293B',
    rgb: '51, 65, 85',
    hoverRgb: '30, 41, 59',
    buttonColor: 'bg-slate-700 text-white',
    cardBorder: 'border-slate-500/50'
  }
];

export const DEFAULT_LOGIN_THEME = LOGIN_COLOR_THEMES[0]; // Innoveity Orange

/**
 * Convert Hex color string to "r, g, b" string
 */
export const hexToRgbString = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return null;
};

/**
 * Resolve login theme configuration by theme ID or hex primaryColor.
 * Falls back to Innoveity Orange default if no match.
 */
export const resolveLoginTheme = (colorOrId) => {
  if (!colorOrId) return DEFAULT_LOGIN_THEME;
  const input = String(colorOrId).toLowerCase().trim();

  // Match by theme ID (e.g. 'emerald', 'blue')
  const matchedById = LOGIN_COLOR_THEMES.find((t) => t.id === input);
  if (matchedById) return matchedById;

  // Match by primary color hex (e.g. '#10b981')
  const matchedByHex = LOGIN_COLOR_THEMES.find((t) => t.primaryColor.toLowerCase() === input);
  if (matchedByHex) return matchedByHex;

  // Custom fallback if a non-preset hex was passed
  const rgb = hexToRgbString(colorOrId) || DEFAULT_LOGIN_THEME.rgb;
  return {
    id: 'custom',
    name: 'Custom Theme',
    primaryColor: colorOrId,
    hoverColor: colorOrId,
    accentColor: colorOrId,
    rgb,
    hoverRgb: rgb,
    buttonColor: 'bg-primary text-white',
    cardBorder: 'border-primary/50'
  };
};
