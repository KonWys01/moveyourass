import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useToggleLike } from '@/api/social';
import { useSession } from '@/auth/session';
import type { SocialEntry, Stats } from '@/api/types';
import { formatDay } from '@/format';
import { useTheme } from '@/theme';

import { Avatar, fullName } from './Avatar';
import { EditWorkoutButton, PhotoStrip } from './WorkoutCard';

export function StatsLine({ stats }: { stats: Stats }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.muted, fontSize: 13 }}>
      Seria {stats.streak} · {stats.week_progress} z {stats.week_threshold}
    </Text>
  );
}

export function EntryCard({
  entry,
  stats,
  showUser = true,
  showDate = true,
  openOnPress = true,
}: {
  entry: SocialEntry;
  stats?: Stats;
  showUser?: boolean;
  showDate?: boolean;
  openOnPress?: boolean;
}) {
  const t = useTheme();
  const router = useRouter();
  const like = useToggleLike();
  const { user: me } = useSession();
  // edit only your own workouts (the feed and profiles show others too)
  const mine = me?.id === entry.user.id;
  const open = () => router.push(`/entry/${entry.id}`);
  // an older backend may not send the counts yet: show 0, not "undefined"
  const likes = entry.like_count ?? 0;
  const comments = entry.comment_count ?? 0;
  const liked = entry.liked_by_me ?? false;

  return (
    <View style={[s.card, { backgroundColor: t.card }]}>
      {showUser && (
        <Pressable
          style={s.header}
          onPress={() => router.push(`/user/${entry.user.id}`)}
        >
          <Avatar user={entry.user} />
          <View>
            <Text style={[s.name, { color: t.text }]}>
              {fullName(entry.user)}
            </Text>
            {stats && <StatsLine stats={stats} />}
          </View>
        </Pressable>
      )}
      {showDate && (
        <Text style={{ color: t.muted, textTransform: 'capitalize' }}>
          {formatDay(entry.date)}
        </Text>
      )}
      {entry.workouts.map((w) => (
        <Pressable key={w.id} onPress={openOnPress ? open : undefined}>
          <View style={s.titleRow}>
            <Text style={[s.title, { color: t.text }]}>
              {w.category.name}
            </Text>
            {mine && <EditWorkoutButton workoutId={w.id} entryId={entry.id} />}
          </View>
          {w.description ? (
            <Text style={{ color: t.muted }}>{w.description}</Text>
          ) : null}
          <View style={{ marginTop: 6 }}>
            <PhotoStrip workout={w} />
          </View>
        </Pressable>
      ))}
      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Cofnij lajk' : 'Polub'}
          onPress={() => like.mutate({ id: entry.id, liked })}
          disabled={like.isPending}
        >
          <Text
            style={{
              color: liked ? t.danger : t.muted,
              fontSize: 16,
            }}
          >
            {liked ? '♥' : '♡'} {likes}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Komentarze"
          onPress={open}
        >
          <Text style={{ color: t.muted, fontSize: 16 }}>
            💬 {comments}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 16, fontWeight: '700' },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 24, marginTop: 4 },
});
