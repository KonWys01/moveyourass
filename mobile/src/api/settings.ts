import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import type { User } from './types';

export type NotifKind =
  | 'reminder'
  | 'like'
  | 'comment'
  | 'follow_request'
  | 'new_follower'
  | 'request_accepted'
  | 'new_activity';

export type NotifPrefs = Record<NotifKind, boolean>;

export const NOTIF_LABELS: [NotifKind, string][] = [
  ['reminder', 'Codzienne przypomnienie (ok. 20:00)'],
  ['like', 'Polubienie mojego wpisu'],
  ['comment', 'Komentarz pod moim wpisem'],
  ['follow_request', 'Prośba o obserwowanie'],
  ['new_follower', 'Ktoś zaczął mnie obserwować'],
  ['request_accepted', 'Moja prośba została zaakceptowana'],
  ['new_activity', 'Obserwowana osoba dodała trening'],
];

export function useNotifPrefs() {
  const { api } = useSession();
  return useQuery({
    queryKey: ['notifPrefs'],
    queryFn: () => api.get<NotifPrefs>('/me/notifications'),
  });
}

export function useSetNotifPref() {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotifPrefs>) =>
      api.patch<NotifPrefs>('/me/notifications', patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['notifPrefs'] });
      const prev = qc.getQueryData<NotifPrefs>(['notifPrefs']);
      if (prev) qc.setQueryData(['notifPrefs'], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifPrefs'], ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(['notifPrefs'], data),
  });
}

export function useUpdateProfile() {
  const { api, setUser } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<User, 'is_public' | 'streak_threshold'>>) =>
      api.patch<User>('/me', patch),
    onSuccess: (user) => {
      setUser(user);
      void qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useDeleteAccount() {
  const { api, signOut } = useSession();
  return useMutation({
    mutationFn: () => api.del('/me'),
    onSuccess: () => signOut(),
  });
}
