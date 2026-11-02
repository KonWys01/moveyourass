import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { GOOGLE_WEB_CLIENT_ID } from '@/config';

let configured = false;

export class GoogleCancelled extends Error {}

/** Returns a Google ID token for our backend (webClientId audience). */
export async function getGoogleIdToken(): Promise<string> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success' || !response.data.idToken) {
    throw new GoogleCancelled();
  }
  return response.data.idToken;
}

export async function googleSignOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // not signed in with Google on this device: nothing to do
  }
}
