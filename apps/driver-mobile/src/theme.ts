import AsyncStorage from '@react-native-async-storage/async-storage';

export type DriverThemeMode = 'light' | 'dark';

export const DRIVER_THEME_STORAGE_KEY = 'tabarak-driver-mobile-theme';

const lightColorPalette = {
  brand: '#B91c1c',
  brandHover: '#991b1b',
  brandDark: '#7f1d1d',
  brandMuted: 'rgba(185, 28, 28, 0.05)',
  brandSoft: '#fef2f2',
  ink: '#0f172a',
  navy: '#0f172a',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  muted: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  rail: 'rgba(241, 245, 249, 0.7)',
  overlay: 'rgba(15, 23, 42, 0.58)',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  page: '#f8fafc',
  success: '#047857',
  successSoft: '#f0fdf4',
  successBorder: '#bbf7d0',
  warning: '#b45309',
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',
  info: '#1d4ed8',
  infoSoft: '#eff6ff',
  infoBorder: '#bfdbfe',
  danger: '#B91c1c',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  white: '#ffffff'
};

const darkColorPalette = {
  brand: '#ef4444',
  brandHover: '#dc2626',
  brandDark: '#991b1b',
  brandMuted: 'rgba(239, 68, 68, 0.14)',
  brandSoft: 'rgba(239, 68, 68, 0.16)',
  ink: '#f8fafc',
  navy: '#020617',
  slate900: '#f8fafc',
  slate800: '#e2e8f0',
  slate700: '#cbd5e1',
  slate600: '#f8fafc',
  muted: '#94a3b8',
  slate400: '#64748b',
  slate300: '#475569',
  border: '#243244',
  borderSoft: '#172033',
  rail: 'rgba(30, 41, 59, 0.78)',
  overlay: 'rgba(2, 6, 23, 0.82)',
  surface: '#111827',
  surfaceMuted: '#1f2937',
  page: '#05070d',
  success: '#34d399',
  successSoft: 'rgba(16, 185, 129, 0.14)',
  successBorder: 'rgba(52, 211, 153, 0.32)',
  warning: '#fbbf24',
  warningSoft: 'rgba(245, 158, 11, 0.14)',
  warningBorder: 'rgba(251, 191, 36, 0.34)',
  info: '#60a5fa',
  infoSoft: 'rgba(59, 130, 246, 0.14)',
  infoBorder: 'rgba(96, 165, 250, 0.34)',
  danger: '#f87171',
  dangerSoft: 'rgba(239, 68, 68, 0.14)',
  dangerBorder: 'rgba(248, 113, 113, 0.34)',
  white: '#ffffff'
};

export type DriverColors = typeof lightColorPalette;

export const lightColors: DriverColors = lightColorPalette;
export const darkColors: DriverColors = darkColorPalette;
export const colors: DriverColors = { ...darkColors };

export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 999
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24
};

export const typography = {
  micro: {
    fontSize: 10,
    fontWeight: '900' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const
  },
  body: {
    fontSize: 13,
    fontWeight: '700' as const
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900' as const
  }
};

const lightShadowPalette = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  brand: {
    shadowColor: '#B91c1c',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  }
};

const darkShadowPalette = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  },
  brand: {
    shadowColor: '#ef4444',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  }
};

export type DriverShadows = typeof lightShadowPalette;

export const shadows: DriverShadows = {
  card: { ...darkShadowPalette.card },
  brand: { ...darkShadowPalette.brand }
};

export const getDriverThemeColors = (themeMode: DriverThemeMode) =>
  themeMode === 'light' ? lightColors : darkColors;

export const applyDriverTheme = (themeMode: DriverThemeMode) => {
  const nextColors = getDriverThemeColors(themeMode);
  const nextShadows = themeMode === 'light' ? lightShadowPalette : darkShadowPalette;
  Object.assign(colors, nextColors);
  shadows.card = { ...nextShadows.card };
  shadows.brand = { ...nextShadows.brand };
  return colors;
};

export const normalizeDriverTheme = (value?: string | null): DriverThemeMode =>
  value === 'light' || value === 'dark' ? value : 'dark';

export const loadSavedDriverTheme = async (): Promise<DriverThemeMode> => {
  const stored = await AsyncStorage.getItem(DRIVER_THEME_STORAGE_KEY);
  return normalizeDriverTheme(stored);
};

export const saveDriverTheme = async (themeMode: DriverThemeMode) => {
  await AsyncStorage.setItem(DRIVER_THEME_STORAGE_KEY, themeMode);
};
