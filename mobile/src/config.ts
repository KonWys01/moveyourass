import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  googleWebClientId?: string;
};

// EXPO_PUBLIC_* are inlined at build time (set in CI / local .env).
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  extra.apiUrl ??
  ''
).replace(/\/$/, '');

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  extra.googleWebClientId ??
  '';
