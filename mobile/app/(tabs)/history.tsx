import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { useHistory } from '@/api/queries';
import type { DayEntry } from '@/api/types';
import { WorkoutCard } from '@/components/WorkoutCard';
import { STATUS_LABEL, formatDay } from '@/format';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

function Day({ entry }: { entry: DayEntry }) {
  const t = useTheme();
  return (
    <View style={s.day}>
      <Text style={[s.date, { color: t.text }]}>{formatDay(entry.date)}</Text>
      {entry.status === 'workout' ? (
        entry.workouts.map((w) => <WorkoutCard key={w.id} workout={w} />)
      ) : (
        <Text style={{ color: t.muted }}>{STATUS_LABEL[entry.status]}</Text>
      )}
    </View>
  );
}

export default function History() {
  const t = useTheme();
  const q = useHistory();
  const entries = q.data?.pages.flat() ?? [];

  if (q.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (q.isError) {
    return (
      <View style={[s.center, { backgroundColor: t.bg, gap: 12 }]}>
        <Text style={{ color: t.danger }}>Nie udało się wczytać historii.</Text>
        <Button title="Spróbuj ponownie" onPress={() => q.refetch()} />
      </View>
    );
  }
  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={s.content}
      data={entries}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => <Day entry={item} />}
      onEndReached={() => q.hasNextPage && q.fetchNextPage()}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      ListEmptyComponent={
        <Text style={{ color: t.muted }}>Jeszcze nic tu nie ma.</Text>
      }
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  day: { gap: 8 },
  date: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
});
