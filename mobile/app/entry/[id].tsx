import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useAddComment,
  useComments,
  useDeleteComment,
  useEntry,
} from '@/api/social';
import { useSession } from '@/auth/session';
import { fullName } from '@/components/Avatar';
import { EntryCard } from '@/components/EntryCard';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { user: me } = useSession();
  const entry = useEntry(id);
  const comments = useComments(id);
  const add = useAddComment(id);
  const del = useDeleteComment(id);
  const [text, setText] = useState('');

  if (entry.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (!entry.data) {
    return (
      <View style={[s.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.danger }}>Ten wpis jest niedostępny.</Text>
      </View>
    );
  }
  const e = entry.data;

  async function send() {
    const value = text.trim();
    if (!value) return;
    try {
      await add.mutateAsync(value);
      setText('');
    } catch {
      // error shown below, text stays so nothing is lost
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.content}>
        <EntryCard entry={e} openOnPress={false} />
        <Text style={[s.heading, { color: t.text }]}>Komentarze</Text>
        {comments.data?.map((c) => {
          const canDelete = me?.id === c.user.id || me?.id === e.user.id;
          return (
            <Pressable
              key={c.id}
              onLongPress={
                canDelete
                  ? () =>
                      Alert.alert('Usunąć komentarz?', undefined, [
                        { text: 'Anuluj', style: 'cancel' },
                        {
                          text: 'Usuń',
                          style: 'destructive',
                          onPress: () => del.mutate(c.id),
                        },
                      ])
                  : undefined
              }
            >
              <Text style={{ color: t.text }}>
                <Text style={{ fontWeight: '700' }}>{fullName(c.user)}: </Text>
                {c.text}
              </Text>
            </Pressable>
          );
        })}
        {comments.data?.length === 0 && (
          <Text style={{ color: t.muted }}>Bądź pierwszy.</Text>
        )}
      </ScrollView>
      {add.isError && (
        <Text style={{ color: t.danger, paddingHorizontal: 16 }}>
          {add.error.message}
        </Text>
      )}
      <View style={[s.compose, { borderTopColor: t.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Napisz komentarz"
          placeholderTextColor={t.muted}
          maxLength={500}
          style={[s.input, { backgroundColor: t.card, color: t.text }]}
        />
        <Button
          title="Wyślij"
          onPress={send}
          loading={add.isPending}
          disabled={!text.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 10 },
  heading: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  compose: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  input: { flex: 1, borderRadius: 12, padding: 10, fontSize: 16 },
});
