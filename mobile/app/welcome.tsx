import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { User } from '@/api/types';
import { useSession } from '@/auth/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function Welcome() {
  const { api, user, setUser, finishOnboarding } = useSession();
  const t = useTheme();
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      setUser(await api.patch<User>('/me', { is_public: isPublic }));
      finishOnboarding();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Coś poszło nie tak.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <Text style={[s.title, { color: t.text }]}>
        Cześć{user ? `, ${user.first_name}` : ''}!
      </Text>
      <Text style={[s.sub, { color: t.muted }]}>
        Kto może oglądać Twoje treningi? Zmienisz to później w
        ustawieniach.
      </Text>
      <Button
        title="Publiczny: widzą wszyscy"
        variant={isPublic ? 'primary' : 'secondary'}
        onPress={() => setIsPublic(true)}
      />
      <Button
        title="Prywatny: tylko zaakceptowani"
        variant={!isPublic ? 'primary' : 'secondary'}
        onPress={() => setIsPublic(false)}
      />
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <Button title="Dalej" onPress={confirm} loading={loading} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 16, lineHeight: 22, marginBottom: 8 },
});
