import { useQueryClient } from '@tanstack/react-query';
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
  const qc = useQueryClient();

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
    // a push while the app is open: refresh what it is about, so an open
    // entry screen shows the new comment without leaving it
    const received = Notifications.addNotificationReceivedListener((n) => {
      const entryId = n.request.content.data?.entry_id;
      if (typeof entryId !== 'string') return;
      void qc.invalidateQueries({ queryKey: ['comments', entryId] });
      void qc.invalidateQueries({ queryKey: ['entry', entryId] });
      void qc.invalidateQueries({ queryKey: ['likes', entryId] });
    });
    return () => {
      stopRefresh();
      sub.remove();
      received.remove();
    };
  }, [api, router, qc]);

  return null;
}
