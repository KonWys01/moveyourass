import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import type {
  Comment,
  FeedItem,
  FollowStatus,
  Profile,
  SocialEntry,
  UserBrief,
  UserSearch,
} from './types';

const PAGE = 20;

export function useFeed() {
  const { api } = useSession();
  return useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<FeedItem[]>('/feed', { limit: PAGE, before: pageParam }),
    getNextPageParam: (last) =>
      last.length < PAGE ? undefined : last[last.length - 1].created_at,
  });
}

export function useSearch(q: string) {
  const { api } = useSession();
  const term = q.trim();
  return useQuery({
    queryKey: ['search', term],
    queryFn: () => api.get<UserSearch[]>('/users/search', { q: term }),
    enabled: term.length >= 2,
  });
}

export function useProfile(id: string) {
  const { api } = useSession();
  return useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.get<Profile>(`/users/${id}`),
  });
}

export function useUserEntries(id: string, enabled: boolean) {
  const { api } = useSession();
  return useInfiniteQuery({
    queryKey: ['userEntries', id],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<SocialEntry[]>(`/users/${id}/entries`, {
        limit: PAGE,
        offset: pageParam,
      }),
    getNextPageParam: (last, all) =>
      last.length < PAGE ? undefined : all.length * PAGE,
  });
}

export function useEntry(id: string) {
  const { api } = useSession();
  return useQuery({
    queryKey: ['entry', id],
    queryFn: () => api.get<SocialEntry>(`/entries/${id}`),
  });
}

function useInvalidate(...keys: string[]) {
  const qc = useQueryClient();
  return (...extra: unknown[][]) =>
    Promise.all([
      ...keys.map((k) => qc.invalidateQueries({ queryKey: [k] })),
      ...extra.map((k) => qc.invalidateQueries({ queryKey: k })),
    ]);
}

export function useFollow(userId: string) {
  const { api } = useSession();
  const invalidate = useInvalidate(
    'profile',
    'feed',
    'search',
    'userEntries',
  );
  return useMutation({
    mutationFn: async (action: 'follow' | 'unfollow') => {
      if (action === 'follow') {
        return api.post<{ status: FollowStatus }>(
          `/users/${userId}/follow`,
        );
      }
      await api.del(`/users/${userId}/follow`);
    },
    onSuccess: () => invalidate(),
  });
}

export function useFollowRequests() {
  const { api } = useSession();
  return useQuery({
    queryKey: ['followRequests'],
    queryFn: () => api.get<UserBrief[]>('/follow-requests'),
  });
}

export function useAnswerRequest() {
  const { api } = useSession();
  const invalidate = useInvalidate('followRequests', 'profile');
  return useMutation({
    mutationFn: ({
      userId,
      accept,
    }: {
      userId: string;
      accept: boolean;
    }) =>
      accept
        ? api.post(`/follow-requests/${userId}/accept`)
        : api.del(`/follow-requests/${userId}`),
    onSuccess: () => invalidate(),
  });
}

export function useToggleLike() {
  const { api } = useSession();
  const invalidate = useInvalidate(
    'feed',
    'entry',
    'userEntries',
    'history',
  );
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      liked
        ? api.del(`/entries/${id}/like`)
        : api.post(`/entries/${id}/like`),
    onSuccess: () => invalidate(),
  });
}

export function useComments(entryId: string) {
  const { api } = useSession();
  return useQuery({
    queryKey: ['comments', entryId],
    queryFn: () => api.get<Comment[]>(`/entries/${entryId}/comments`),
  });
}

export function useAddComment(entryId: string) {
  const { api } = useSession();
  const invalidate = useInvalidate('feed', 'entry', 'userEntries', 'history');
  return useMutation({
    mutationFn: (text: string) =>
      api.post<Comment>(`/entries/${entryId}/comments`, { text }),
    onSuccess: () => invalidate(['comments', entryId]),
  });
}

export function useDeleteComment(entryId: string) {
  const { api } = useSession();
  const invalidate = useInvalidate('feed', 'entry', 'userEntries', 'history');
  return useMutation({
    mutationFn: (commentId: string) => api.del(`/comments/${commentId}`),
    onSuccess: () => invalidate(['comments', entryId]),
  });
}
