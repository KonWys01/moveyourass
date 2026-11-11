import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDeleteEntry, useHistory } from '@/api/queries';
import type { SocialEntry } from '@/api/types';
import { EntryCard } from '@/components/EntryCard';
import { HistoryCalendar } from '@/components/HistoryCalendar';
import { StatsView } from '@/components/StatsView';
import { confirmDelete } from '@/confirm';
import { STATUS_LABEL, formatDay } from '@/format';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

function Day({ entry }: { entry: SocialEntry }) {
  const t = useTheme();
  const del = useDeleteEntry();
  return (
    <View style={s.day}>
      <Text style={[s.date, { color: t.text }]}>{formatDay(entry.date)}</Text>
      {entry.status === 'workout' ? (
        // same card as on the feed: likes, comments, tap opens the entry
        <EntryCard entry={entry} showUser={false} showDate={false} />
      ) : (
        <View style={s.statusRow}>
          <Text style={{ color: t.muted }}>{STATUS_LABEL[entry.status]}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usuń dzień"
            disabled={del.isPending}
            onPress={() =>
              confirmDelete(
                `Usunąć wpis „${STATUS_LABEL[entry.status]}”?`,
                () => del.mutate(entry.id),
              )
            }
            hitSlop={8}
          >
            <Text style={{ color: t.danger, fontWeight: '600' }}>Usuń</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function HistoryList() {
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

type View_ = 'list' | 'calendar' | 'stats';

const VIEWS: [View_, string][] = [
  ['list', 'Lista'],
  ['calendar', 'Kalendarz'],
  ['stats', 'Statystyki'],
];

export default function History() {
  const t = useTheme();
  const [view, setView] = useState<View_>('list');
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.segments, { backgroundColor: t.card }]}>
        {VIEWS.map(([key, label]) => {
          const active = key === view;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setView(key)}
              style={[
                s.segment,
                { backgroundColor: active ? t.primary : 'transparent' },
              ]}
            >
              <Text
                style={{
                  color: active ? t.onPrimary : t.text,
                  fontWeight: '600',
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {view === 'list' ? (
        <HistoryList />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {view === 'calendar' ? <HistoryCalendar /> : <StatsView />}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  day: { gap: 8 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
});
