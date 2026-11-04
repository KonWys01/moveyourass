import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ApiError } from '@/api/client';
import { useAddWorkout } from '@/api/queries';

jest.mock('expo-image-picker', () => ({}));

const mockApi = { get: jest.fn(), post: jest.fn(), upload: jest.fn() };
jest.mock('@/auth/session', () => ({
  useSession: () => ({ api: mockApi }),
}));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const entry = {
  id: 'e1',
  date: '2026-01-05',
  created_at: '2026-01-05T10:00:00+00:00',
  status: 'workout',
  workouts: [{ id: 'w1', category: { id: 1, name: 'Bieganie' } }],
};

beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockReset());
  mockApi.post.mockResolvedValue(entry);
  mockApi.get.mockResolvedValue([]);
});

test('the workout is kept and the first photo error is reported', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockApi.upload
    .mockResolvedValueOnce({ id: 'p1', url: 'u' })
    .mockRejectedValueOnce(new ApiError(413, 'Image too large'))
    .mockRejectedValueOnce(new ApiError(0, 'Brak połączenia (x)'));
  const { result } = await renderHook(() => useAddWorkout(), {
    wrapper: wrapper(),
  });

  let outcome: { failed: number; firstError: string } | undefined;
  await act(async () => {
    outcome = await result.current.mutateAsync({
      categoryId: 1,
      description: '',
      photoUris: ['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg'],
    });
  });

  expect(mockApi.post).toHaveBeenCalledTimes(1);
  expect(outcome!.failed).toBe(2);
  expect(outcome!.firstError).toContain('413: Image too large');
  expect(outcome!.firstError).toContain('file:///b.jpg');
  await waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
  warn.mockRestore();
});

test('no photos failing means no error text', async () => {
  mockApi.upload.mockResolvedValue({ id: 'p', url: 'u' });
  const { result } = await renderHook(() => useAddWorkout(), {
    wrapper: wrapper(),
  });

  let outcome: { failed: number; firstError: string } | undefined;
  await act(async () => {
    outcome = await result.current.mutateAsync({
      categoryId: 1,
      description: 'x',
      photoUris: ['file:///a.jpg'],
    });
  });

  expect(outcome).toEqual({ failed: 0, firstError: '' });
});
