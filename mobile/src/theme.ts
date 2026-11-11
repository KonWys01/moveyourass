import { useColorScheme } from 'react-native';

const light = {
  bg: '#ffffff',
  card: '#f3f4f6',
  text: '#111827',
  muted: '#6b7280',
  primary: '#16a34a',
  onPrimary: '#ffffff',
  danger: '#dc2626',
  warn: '#d97706',
  border: '#e5e7eb',
};
const dark: typeof light = {
  bg: '#0b0f14',
  card: '#161b22',
  text: '#f3f4f6',
  muted: '#9ca3af',
  primary: '#22c55e',
  onPrimary: '#05220f',
  danger: '#f87171',
  warn: '#fbbf24',
  border: '#262d36',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
