import * as Application from 'expo-application';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createApi, type Api } from '@/api/client';
import type { TokenResponse, User } from '@/api/types';
import { API_URL } from '@/config';

import { getGoogleIdToken, googleSignOut } from './google';
import { clearToken, loadToken, saveToken } from './tokenStore';

type Status = 'loading' | 'signedOut' | 'signedIn';

type Session = {
  status: Status;
  user: User | null;
  /** true right after the very first login: ask public/private. */
  isNewUser: boolean;
  api: Api;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
  finishOnboarding: () => void;
};

const Ctx = createContext<Session | null>(null);

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  const signOut = useCallback(async () => {
    tokenRef.current = null;
    await clearToken();
    await googleSignOut();
    setUser(null);
    setIsNewUser(false);
    setStatus('signedOut');
  }, []);

  const api = useMemo(
    () =>
      createApi({
        baseUrl: API_URL,
        appVersion: Application.nativeApplicationVersion ?? '0.0.0',
        getToken: () => tokenRef.current,
        onUnauthorized: () => {
          void signOut();
        },
      }),
    [signOut],
  );

  // The server computes "today" from the user's stored timezone, so keep
  // it in sync with the device (travel, DST rules changes, new phone).
  const syncTimezone = useCallback(
    async (u: User) => {
      const tz = deviceTimezone();
      if (tz !== u.timezone) {
        try {
          setUser(await api.patch<User>('/me', { timezone: tz }));
        } catch {
          // not critical; retried on next start
        }
      }
    },
    [api],
  );

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (!token) return setStatus('signedOut');
      tokenRef.current = token;
      try {
        const me = await api.get<User>('/me');
        setUser(me);
        setStatus('signedIn');
        void syncTimezone(me);
      } catch (e) {
        // 401 already signed us out; on network errors stay signed
        // out for now rather than show a broken app.
        if (tokenRef.current) await signOut();
      }
    })();
  }, [api, signOut, syncTimezone]);

  const signInWithGoogle = useCallback(async () => {
    const idToken = await getGoogleIdToken();
    const res = await api.post<TokenResponse>('/auth/google', {
      id_token: idToken,
      timezone: deviceTimezone(),
    });
    tokenRef.current = res.access_token;
    await saveToken(res.access_token);
    setUser(res.user);
    setIsNewUser(res.is_new_user);
    setStatus('signedIn');
  }, [api]);

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      isNewUser,
      api,
      signInWithGoogle,
      signOut,
      setUser,
      finishOnboarding: () => setIsNewUser(false),
    }),
    [status, user, isNewUser, api, signInWithGoogle, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
