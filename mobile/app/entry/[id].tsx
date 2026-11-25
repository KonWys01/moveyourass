import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  useLikes,
} from '@/api/social';
import { useSession } from '@/auth/session';
import { fullName } from '@/components/Avatar';
import { EntryCard } from '@/components/EntryCard';
import { useKeyboardOverlap } from '@/keyboard';
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
  const likes = useLikes(
    id,
    !!entry.data && me?.id === entry.data.user.id && entry.data.like_count > 0,
  );
  const [text, setText] = useState('');
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const keyboard = useKeyboardOverlap(rootRef);

  useEffect(() => {
    if (keyboard > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd());
    }
  }, [keyboard]);

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
    <View
      ref={rootRef}
      style={{ flex: 1, backgroundColor: t.bg, paddingBottom: keyboard }}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        // keep the newest comments in view while typing
        onContentSizeChange={() => {
          if (keyboard > 0) scrollRef.current?.scrollToEnd();
        }}
      >
        <EntryCard entry={e} openOnPress={false} />
        {likes.data && likes.data.length > 0 && (
          <Text style={{ color: t.muted }}>
            Polubili:{' '}
            {likes.data
              .map((u) => `${u.first_name} ${u.last_name.charAt(0)}.`)
              .join(', ')}
          </Text>
        )}
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
    </View>
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
