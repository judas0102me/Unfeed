import { useColorScheme } from 'react-native';

// Paleta clara y oscura. El acento es un violeta propio de Unfeed (no los colores de TikTok).
const light = {
  background: '#FFFFFF',
  surface: '#F4F4F6',
  border: '#E3E3E8',
  text: '#16161D',
  textMuted: '#6B6B76',
  accent: '#5B3FD9',
  accentText: '#FFFFFF',
  danger: '#D93F3F',
  success: '#2E9E5B',
};

const dark: typeof light = {
  background: '#0E0E12',
  surface: '#1B1B22',
  border: '#2C2C35',
  text: '#F2F2F5',
  textMuted: '#9A9AA6',
  accent: '#8C74FF',
  accentText: '#0E0E12',
  danger: '#FF6B6B',
  success: '#4CC983',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20 } as const;
