import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { useFeed } from '@/api/social';
import { EntryCard } from '@/components/EntryCard';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function Feed() {
  const t = useTheme();
  const q = useFeed();
  const items = q.data?.pages.flat() ?? [];

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
        <Text style={{ color: t.danger }}>Nie udało się wczytać tablicy.</Text>
        <Button title="Spróbuj ponownie" onPress={() => q.refetch()} />
      </View>
    );
  }
  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={s.content}
      data={items}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => <EntryCard entry={item} stats={item.stats} />}
      onEndReached={() => q.hasNextPage && q.fetchNextPage()}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      ListEmptyComponent={
        <Text style={{ color: t.muted }}>
          Tu pojawią się treningi osób, które obserwujesz. Znajdź kogoś w
          zakładce Szukaj.
        </Text>
      }
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
});
