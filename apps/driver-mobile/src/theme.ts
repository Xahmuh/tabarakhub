export const colors = {
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

export const shadows = {
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
