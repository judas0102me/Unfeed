import { useColorScheme } from 'react-native';

// Paleta de goma de borrar: rosa y tinta azul. El rosa encendido es la línea que tacha.
const light = {
  background: '#FBE4E6',
  surface: '#FFF3F4',
  border: '#EDC3CB',
  text: '#1B1E4B',
  textMuted: '#615D80',
  accent: '#C81E4A',
  accentText: '#FFFFFF',
  danger: '#B3173F',
  success: '#1F7A52',
};

const dark: typeof light = {
  background: '#14163A',
  surface: '#1F2250',
  border: '#343872',
  text: '#FDE8EB',
  textMuted: '#ABA9CF',
  accent: '#FF7A96',
  accentText: '#14163A',
  danger: '#FF7A96',
  success: '#5FD3A2',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  display: 'BigShoulders_900Black',
  regular: 'InstrumentSans_400Regular',
  strong: 'InstrumentSans_600SemiBold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 6, md: 14, lg: 20 } as const;
