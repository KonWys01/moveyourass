import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from '@/auth/session';
import {
  registerDevice,
  setupNotificationHandler,
  targetFor,
  watchTokenRefresh,
} from '@/push';

/** Mounted only for signed-in users: registers the device, routes taps. */
export function PushBootstrap() {
  const { api } = useSession();
  const router = useRouter();

  useEffect(() => {
    setupNotificationHandler();
    void registerDevice(api);
    const stopRefresh = watchTokenRefresh(api);

    const open = (response: Notifications.NotificationResponse | null) => {
      const target = targetFor(
        response?.notification.request.content.data,
      );
      if (target) router.push(target.path as never);
    };
    // tapped while the app was closed
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      stopRefresh();
      sub.remove();
    };
  }, [api, router]);

  return null;
}
