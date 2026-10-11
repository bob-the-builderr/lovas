import 'react-native-url-polyfill/auto';

export const Env = {
  API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.example.com',
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME ?? 'Lovas',
  APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0',
  ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
} as const;

export type EnvKey = keyof typeof Env;

export function getEnv(key: EnvKey): string {
  const value = Env[key];
  if (!value && process.env.NODE_ENV === 'production' && key !== 'SENTRY_DSN') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
