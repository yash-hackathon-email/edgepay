// ─── EdgePay Design Tokens (Themed) ────────────────────────────────────

import { useStore } from '../store/useStore';

export const lightColors = {
  primary: '#0A84FF',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#E5E5EA',
  card: '#FFFFFF',
  cardBorder: 'rgba(0, 0, 0, 0.05)',
  textPrimary: '#000000',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  textTertiary: 'rgba(0, 0, 0, 0.3)',
  border: 'rgba(0, 0, 0, 0.1)',
  borderLight: 'rgba(0, 0, 0, 0.05)',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  gsmActive: '#FF9500',
  gsmBackground: 'rgba(255, 149, 0, 0.08)',
  gsmBorder: 'rgba(255, 149, 0, 0.2)',
};

export const darkColors = {
  primary: '#0A84FF',
  background: '#0A0A0F',
  surface: '#13131A',
  surfaceElevated: '#1A1A24',
  surfaceHighlight: '#252530',
  card: '#15151E',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F5F5F7',
  textSecondary: 'rgba(245, 245, 247, 0.65)',
  textTertiary: 'rgba(245, 245, 247, 0.4)',
  border: 'rgba(255, 255, 255, 0.10)',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  error: '#FF453A',
  success: '#30D158',
  warning: '#FF9F0A',
  gsmActive: '#FF9F0A',
  gsmBackground: 'rgba(255, 159, 10, 0.08)',
  gsmBorder: 'rgba(255, 159, 10, 0.2)',
};

export const useTheme = () => {
  const theme = useStore(state => state.theme);
  const colors = theme === 'dark' ? darkColors : lightColors;
  return { colors, theme };
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48, xxl: 56,
};

export const borderRadius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, xxl: 32, full: 999,
};

export const gradients = {
  primary: ['#0A84FF', '#0066CC'],
  success: ['#30D158', '#25A844'],
  error: ['#FF453A', '#CC362E'],
  glass: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'],
};

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  bodyLarge: { fontSize: 17, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18, textTransform: 'uppercase' as const },
  labelSmall: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, textTransform: 'uppercase' as const },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  button: {
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Legacy support for files not using the hook yet
export const colors = darkColors;
