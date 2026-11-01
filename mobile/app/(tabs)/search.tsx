import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useAnswerRequest,
  useFollowRequests,
  useSearch,
} from '@/api/social';
import type { FollowStatus, UserBrief } from '@/api/types';
import { Avatar, fullName } from '@/components/Avatar';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

const STATUS_TEXT: Record<FollowStatus, string> = {
  none: '',
  pending: 'Prośba wysłana',
  accepted: 'Obserwujesz',
};

export function Row({
  user,
  right,
  onPress,
}: {
  user: UserBrief;
  right?: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable style={s.row} onPress={onPress}>
      <Avatar user={user} />
      <Text style={[s.name, { color: t.text }]}>
        {fullName(user)} {user.is_public ? '' : '🔒'}
      </Text>
      {right ? <Text style={{ color: t.muted }}>{right}</Text> : null}
    </Pressable>
  );
}

export default function Search() {
  const t = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const results = useSearch(term);
  const requests = useFollowRequests();
  const answer = useAnswerRequest();

  // debounce: do not hit the API on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setTerm(text), 350);
    return () => clearTimeout(id);
  }, [text]);

  const pending = requests.data ?? [];
  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Szukaj osób po imieniu lub nazwisku"
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        style={[s.input, { backgroundColor: t.card, color: t.text }]}
      />
      {pending.length > 0 && (
        <View style={s.block}>
          <Text style={[s.heading, { color: t.text }]}>
            Prośby o obserwowanie ({pending.length})
          </Text>
          {pending.map((u) => (
            <View key={u.id} style={s.request}>
              <Row user={u} onPress={() => router.push(`/user/${u.id}`)} />
              <View style={s.buttons}>
                <Button
                  title="Akceptuj"
                  onPress={() =>
                    answer.mutate({ userId: u.id, accept: true })
                  }
                  disabled={answer.isPending}
                />
                <Button
                  title="Odrzuć"
                  variant="secondary"
                  onPress={() =>
                    answer.mutate({ userId: u.id, accept: false })
                  }
                  disabled={answer.isPending}
                />
              </View>
            </View>
          ))}
        </View>
      )}
      <FlatList
        data={term.trim().length >= 2 ? (results.data ?? []) : []}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Row
            user={item}
            right={STATUS_TEXT[item.follow_status]}
            onPress={() => router.push(`/user/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          term.trim().length >= 2 && !results.isLoading ? (
            <Text style={{ color: t.muted }}>Nikogo nie znaleziono.</Text>
          ) : undefined
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  input: { borderRadius: 12, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  name: { fontSize: 16, flex: 1 },
  block: { gap: 8 },
  heading: { fontSize: 16, fontWeight: '700' },
  request: { gap: 6 },
  buttons: { flexDirection: 'row', gap: 8 },
});
