import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { describeError, shortUri } from '@/format';

import { buildPhotoForm } from './photos';
import type { Category, DayEntry, Photo, Today } from './types';

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
      api.get<DayEntry[]>('/entries/me', {
        limit: PAGE,
        offset: pageParam,
      }),
    getNextPageParam: (last, all) =>
      last.length < PAGE ? undefined : all.length * PAGE,
  });
}

export function useInvalidateEntries() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['today'] }),
      qc.invalidateQueries({ queryKey: ['history'] }),
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
