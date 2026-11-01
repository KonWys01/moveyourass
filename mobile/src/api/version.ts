import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

export type VersionInfo = {
  current_version: string | null;
  latest_version: string;
  min_version: string;
  download_url: string;
  update_available: boolean;
  update_required: boolean;
};

export function useVersion() {
  const { api } = useSession();
  return useQuery({
    queryKey: ['version'],
    queryFn: () => api.get<VersionInfo>('/app/version'),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}
