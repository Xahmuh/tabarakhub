export const colors = {
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
