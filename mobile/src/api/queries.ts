import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { describeError, shortUri } from '@/format';

import { buildPhotoForm } from './photos';
import type {
  Category,
  DayEntry,
  CalendarMonth,
  MyStats,
  Photo,
  SocialEntry,
  Today,
  Workout,
} from './types';

export function useToday() {
  const { api } = useSession();
  return useQuery({
    queryKey: ['today'],
    queryFn: () => api.get<Today>('/entries/today'),
  });
}

export function useCategories() {
  const { api } = useSession();
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    staleTime: 10 * 60 * 1000,
  });
}

const PAGE = 20;

export function useHistory() {
  const { api } = useSession();
  return useInfiniteQuery({
    queryKey: ['history'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<SocialEntry[]>('/entries/me', {
        limit: PAGE,
        offset: pageParam,
      }),
    getNextPageParam: (last, all) =>
      last.length < PAGE ? undefined : all.length * PAGE,
  });
}

export function useCalendar(month: string) {
  const { api } = useSession();
  return useQuery({
    queryKey: ['calendar', month],
    queryFn: () => api.get<CalendarMonth>('/me/calendar', { month }),
  });
}

export function useStats() {
  const { api } = useSession();
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<MyStats>('/me/stats'),
  });
}

export function useInvalidateEntries() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['today'] }),
      qc.invalidateQueries({ queryKey: ['history'] }),
      // the same entry can be on the feed, a profile or its own screen
      qc.invalidateQueries({ queryKey: ['feed'] }),
      qc.invalidateQueries({ queryKey: ['entry'] }),
      qc.invalidateQueries({ queryKey: ['userEntries'] }),
      qc.invalidateQueries({ queryKey: ['calendar'] }),
      qc.invalidateQueries({ queryKey: ['stats'] }),
    ]);
}

export function useMarkDay() {
  const { api } = useSession();
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: (kind: 'rest' | 'sick') =>
      api.post<DayEntry>(`/entries/${kind}`),
    onSuccess: invalidate,
  });
}

export function useUploadPhoto() {
  const { api } = useSession();
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: ({ workoutId, uri }: { workoutId: string; uri: string }) =>
      api.upload<Photo>(`/workouts/${workoutId}/photos`, buildPhotoForm(uri)),
    onSuccess: invalidate,
  });
}

export function useDeletePhoto() {
  const { api } = useSession();
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: (photoId: string) => api.del(`/photos/${photoId}`),
    onSuccess: invalidate,
  });
}

export function useUpdateWorkout() {
  const { api } = useSession();
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: ({
      id,
      categoryId,
      description,
    }: {
      id: string;
      categoryId: number;
      description: string;
    }) =>
      api.patch<Workout>(`/workouts/${id}`, {
        category_id: categoryId,
        description: description.trim() || null,
      }),
    onSuccess: invalidate,
  });
}

// Deleting does not wait for the refetch: the screen that triggered it
// is about to close, and the removed item must not flash an error.
export function useDeleteWorkout() {
  const { api } = useSession();
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: (workoutId: string) => api.del(`/workouts/${workoutId}`),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useDeleteEntry() {
  const { api } = useSession();
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: (entryId: string) => api.del(`/entries/${entryId}`),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export type NewWorkout = {
  categoryId: number;
  description: string;
  photoUris: string[];
};

/**
 * Creates the workout, then uploads photos one by one. A failed photo
 * does not undo the workout: the result lists what failed so the UI
 * can say so (user can add the photo later from the workout card).
 */
export function useAddWorkout() {
  const { api } = useSession();
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: async (w: NewWorkout) => {
      const entry = await api.post<DayEntry>('/entries/workouts', {
        category_id: w.categoryId,
        description: w.description.trim() || null,
      });
      // newest workout is last (ordered by created_at)
      const workoutId = entry.workouts[entry.workouts.length - 1].id;
      let failed = 0;
      let firstError = '';
      for (const uri of w.photoUris) {
        try {
          await api.upload<Photo>(
            `/workouts/${workoutId}/photos`,
            buildPhotoForm(uri),
          );
        } catch (e) {
          failed += 1;
          console.warn('photo upload failed', shortUri(uri), e);
          if (!firstError) {
            firstError = `${describeError(e)}\nPlik: ${shortUri(uri)}`;
          }
        }
      }
      return { failed, firstError };
    },
    onSuccess: invalidate,
  });
}
