import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFollow, useProfile, useUserEntries } from '@/api/social';
import { useSession } from '@/auth/session';
import { Avatar, fullName } from '@/components/Avatar';
import { EntryCard, StatsLine } from '@/components/EntryCard';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { user: me } = useSession();
  const profile = useProfile(id);
  const follow = useFollow(id);
  const entries = useUserEntries(id, profile.data?.can_view ?? false);

  if (profile.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  const p = profile.data;
  if (!p) {
    return (
      <View style={[s.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.danger }}>Nie znaleziono użytkownika.</Text>
      </View>
    );
  }
  const isMe = me?.id === p.id;
  const items = entries.data?.pages.flat() ?? [];

  const header = (
    <View style={s.header}>
      <Avatar user={p} size={72} />
      <Text style={[s.name, { color: t.text }]}>
        {fullName(p)} {p.is_public ? '' : '🔒'}
      </Text>
      {p.stats && <StatsLine stats={p.stats} />}
      {!isMe && (
        <Button
          title={
            p.follow_status === 'accepted'
              ? 'Obserwujesz'
              : p.follow_status === 'pending'
                ? 'Prośba wysłana'
                : 'Obserwuj'
          }
          variant={p.follow_status === 'none' ? 'primary' : 'secondary'}
          loading={follow.isPending}
          onPress={() =>
            follow.mutate(p.follow_status === 'none' ? 'follow' : 'unfollow')
          }
        />
      )}
      {follow.isError && (
        <Text style={{ color: t.danger }}>{follow.error.message}</Text>
      )}
      {!p.can_view && (
        <Text style={{ color: t.muted, textAlign: 'center' }}>
          Profil prywatny. Treningi widzą tylko zaakceptowani obserwujący.
        </Text>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: fullName(p) }} />
      <FlatList
        style={{ backgroundColor: t.bg }}
        contentContainerStyle={s.content}
        data={items}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <EntryCard entry={item} showUser={false} />}
        onEndReached={() => entries.hasNextPage && entries.fetchNextPage()}
      />
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  header: { alignItems: 'center', gap: 8, marginBottom: 8 },
  name: { fontSize: 22, fontWeight: '800' },
});
