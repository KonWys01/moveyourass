import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { SessionProvider, useSession } from '@/auth/session';
import { PushBootstrap } from '@/components/PushBootstrap';
import { UpdateGate } from '@/components/UpdateGate';
import { useTheme } from '@/theme';

function Routes() {
  const { status, isNewUser } = useSession();
  const t = useTheme();
  if (status === 'loading') return null;
  return (
    <UpdateGate>
      {status === 'signedIn' && !isNewUser && <PushBootstrap />}
      <Stack
        screenOptions={{
          headerShown: false,
          // headers/screens of user, entry, add-workout follow the theme
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
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
          <Stack.Screen
            name="edit-workout/[id]"
            options={{
              headerShown: true,
              title: 'Edytuj trening',
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
