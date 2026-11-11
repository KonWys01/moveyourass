import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useStats } from '@/api/queries';
import type { Badge } from '@/api/types';
import { pluralDays, shortDate } from '@/format';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

function Tile({
  value,
  label,
  accessibilityLabel,
}: {
  value: string | number;
  label: string;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={[s.tile, { backgroundColor: t.card }]}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[s.value, { color: t.text }]}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function BadgeTile({ badge }: { badge: Badge }) {
  const t = useTheme();
  const pct = badge.target
    ? Math.min(1, badge.progress / badge.target)
    : 0;
  return (
    <View
      style={[s.badge, { backgroundColor: t.card }]}
      accessibilityLabel={`${badge.title}: ${
        badge.earned ? 'zdobyta' : `${badge.progress}/${badge.target}`
      }`}
    >
      <Text style={[s.icon, { opacity: badge.earned ? 1 : 0.3 }]}>
        {badge.icon}
      </Text>
      <Text
        style={{
          color: badge.earned ? t.text : t.muted,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {badge.title}
      </Text>
      <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>
        {badge.description}
      </Text>
      {!badge.earned && (
        <View style={{ width: '100%', gap: 2 }}>
          <View style={[s.track, { backgroundColor: t.border }]}>
            <View
              style={[
                s.fill,
                { backgroundColor: t.primary, width: `${pct * 100}%` },
              ]}
            />
          </View>
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>
            {badge.progress}/{badge.target}
          </Text>
        </View>
      )}
    </View>
  );
}

export function StatsView() {
  const t = useTheme();
  const q = useStats();

  if (q.isLoading) return <ActivityIndicator color={t.primary} />;
  if (q.isError || !q.data) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: t.danger }}>
          Nie udało się wczytać statystyk.
        </Text>
        <Button title="Spróbuj ponownie" onPress={() => q.refetch()} />
      </View>
    );
  }
  const d = q.data;
  const maxDays = Math.max(1, ...d.weeks.map((w) => w.days));
  const maxCat = Math.max(1, ...d.categories.map((c) => c.count));
  const BAR = 90;

  return (
    <View style={s.wrap}>
      <View style={s.grid}>
        <Tile value={d.total_workouts} label="Treningi łącznie" />
        <Tile value={d.active_days} label="Dni aktywne" />
        <Tile value={d.total_photos} label="Zdjęcia" />
        <Tile value={d.this_month.workouts} label="Treningi w tym miesiącu" />
        <Tile value={`🔥 ${d.current_streak}`} label="Seria (tyg.)" />
        <Tile value={`🏆 ${d.longest_streak}`} label="Rekord serii (tyg.)" />
      </View>
      <Text style={{ color: t.muted }}>
        Najlepszy tydzień: {pluralDays(d.best_week_days)} z treningiem
      </Text>

      <Text style={[s.heading, { color: t.text }]}>Ostatnie 12 tygodni</Text>
      <View style={s.chart} accessibilityLabel="Wykres tygodni">
        {d.weeks.map((w, i) => (
          <View key={w.week_start} style={s.barCol}>
            <View style={{ height: BAR, justifyContent: 'flex-end' }}>
              <View
                testID="week-bar"
                accessibilityLabel={`Tydzień od ${shortDate(w.week_start)}: ${w.days}`}
                style={{
                  height: Math.max(
                    w.days ? 4 : 2,
                    (w.days / maxDays) * BAR,
                  ),
                  borderRadius: 4,
                  backgroundColor: w.days ? t.primary : t.border,
                }}
              />
            </View>
            <Text style={{ color: t.muted, fontSize: 10 }}>
              {i % 3 === 0 ? shortDate(w.week_start) : ' '}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: 12 }}>
        Dni z treningiem w tygodniu
      </Text>

      <Text style={[s.heading, { color: t.text }]}>Kategorie</Text>
      {d.categories.length === 0 && (
        <Text style={{ color: t.muted }}>Jeszcze brak treningów.</Text>
      )}
      {d.categories.map((c) => (
        <View key={c.name} style={{ gap: 2 }}>
          <View style={s.catRow}>
            <Text style={{ color: t.text }}>{c.name}</Text>
            <Text style={{ color: t.muted }}>{c.count}</Text>
          </View>
          <View style={[s.track, { backgroundColor: t.border }]}>
            <View
              testID="category-bar"
              style={[
                s.fill,
                {
                  backgroundColor: t.primary,
                  width: `${(c.count / maxCat) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}

      <Text style={[s.heading, { color: t.text }]}>Osiągnięcia</Text>
      <View style={s.grid}>
        {d.badges.map((b) => (
          <BadgeTile key={b.id} badge={b} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48%', borderRadius: 14, padding: 14, gap: 2 },
  value: { fontSize: 24, fontWeight: '800' },
  heading: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  chart: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  badge: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    alignItems: 'center',
  },
  icon: { fontSize: 32 },
});
