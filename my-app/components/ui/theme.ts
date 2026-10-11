// Lovas brand palette — warm, romantic, playful.
export const Palette = {
  primary: '#FF5A79', // rose
  primaryLight: '#FFD9E1',
  secondary: '#9B6BFF', // lilac
  secondaryLight: '#E8DDFF',
  accent: '#FFB84D', // amber
  background: '#FFF9FA',
  card: '#FFFFFF',
  surfaceAlt: '#FFF0F3',
  text: '#3A2A2F',
  textMuted: '#9C8C93',
  border: '#F3E1E5',
  white: '#FFFFFF',
  black: '#000000',
  success: '#2FA36B',
  error: '#E5484D',
  peach: '#FF9E9E',
  mint: '#7CE0C0',
} as const;

export type Theme = {
  primary: string;
  primaryLight: string;
  secondary: string;
  secondaryLight: string;
  accent: string;
  background: string;
  card: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  white: string;
  black: string;
  success: string;
  error: string;
};

export const lightTheme: Theme = { ...Palette };
