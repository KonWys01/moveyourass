import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GoogleCancelled } from '@/auth/google';
import { useSession } from '@/auth/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function SignIn() {
  const { signInWithGoogle } = useSession();
  const t = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPress() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (!(e instanceof GoogleCancelled)) {
        setError(
          e instanceof Error ? e.message : 'Nie udało się zalogować.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <Text style={[s.title, { color: t.text }]}>MoveYourAss</Text>
      <Text style={[s.sub, { color: t.muted }]}>
        Codziennie jeden ruch. Potwierdź go zdjęciem i pokaż znajomym.
      </Text>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <Button
        title="Zaloguj się przez Google"
        onPress={onPress}
        loading={loading}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '800' },
  sub: { fontSize: 16, lineHeight: 22 },
});
