import * as Notifications from 'expo-notifications';

import type { Api } from '@/api/client';

let currentToken: string | null = null;

/** Show pushes as banners while the app is open. */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Asks for permission and registers the native FCM token with the
 * backend. Returns the token, or null if the user said no. Never throws:
 * push is optional, the app must work without it.
 */
export async function registerDevice(api: Api): Promise<string | null> {
  try {
    // Android 13+: the channel must exist before the permission prompt.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Powiadomienia',
      importance: Notifications.AndroidImportance.MAX,
    });
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;
    const token = (await Notifications.getDevicePushTokenAsync())
      .data as string;
    await api.post('/devices', { token });
    currentToken = token;
    return token;
  } catch {
    return null;
  }
}

/** Re-register when FCM rotates the token. */
export function watchTokenRefresh(api: Api): () => void {
  const sub = Notifications.addPushTokenListener(async ({ data }) => {
    try {
      await api.post('/devices', { token: data as string });
      currentToken = data as string;
    } catch {
      // retried on next app start
    }
  });
  return () => sub.remove();
}

/** Called on sign-out, while the session token is still valid. */
export async function unregisterDevice(api: Api): Promise<void> {
  const token = currentToken;
  currentToken = null; // first: a 401 here must not re-enter
  if (!token) return;
  try {
    await api.del(`/devices/${encodeURIComponent(token)}`);
  } catch {
    // best effort; the backend also drops dead tokens itself
  }
}

export type PushTarget = { path: string } | null;

/** Where a tapped notification should lead (data comes from backend). */
export function targetFor(
  data: Record<string, unknown> | undefined,
): PushTarget {
  if (!data) return null;
  if (typeof data.entry_id === 'string') {
    return { path: `/entry/${data.entry_id}` };
  }
  if (typeof data.user_id === 'string') {
    return { path: `/user/${data.user_id}` };
  }
  return null; // e.g. the daily reminder: just open the app
}
