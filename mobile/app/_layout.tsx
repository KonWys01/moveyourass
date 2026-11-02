import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { SessionProvider, useSession } from '@/auth/session';
import { PushBootstrap } from '@/components/PushBootstrap';
import { UpdateGate } from '@/components/UpdateGate';

function Routes() {
  const { status, isNewUser } = useSession();
  if (status === 'loading') return null;
  return (
    <UpdateGate>
      {status === 'signedIn' && !isNewUser && <PushBootstrap />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedIn' && isNewUser}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedIn' && !isNewUser}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="user/[id]"
            options={{ headerShown: true, title: '' }}
          />
          <Stack.Screen
            name="entry/[id]"
            options={{ headerShown: true, title: 'Wpis' }}
          />
          <Stack.Screen
            name="add-workout"
            options={{
              headerShown: true,
              title: 'Nowy trening',
              presentation: 'modal',
            }}
          />
        </Stack.Protected>
      </Stack>
    </UpdateGate>
  );
}

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <StatusBar style="auto" />
        <Routes />
      </SessionProvider>
    </QueryClientProvider>
  );
}
