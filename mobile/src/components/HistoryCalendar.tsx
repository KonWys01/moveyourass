import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCalendar, useDeleteEntry } from '@/api/queries';
import type { CalendarDay } from '@/api/types';
import { confirmDelete } from '@/confirm';
import {
  STATUS_LABEL,
  WEEKDAYS_SHORT,
  dayOf,
  formatDay,
  localDayString,
  monthGrid,
  monthLabel,
  monthString,
  shiftMonth,
} from '@/format';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export function HistoryCalendar() {
  const t = useTheme();
  const router = useRouter();
  const del = useDeleteEntry();
  const current = monthString();
  const [month, setMonth] = useState(current);
  const q = useCalendar(month);
  const today = localDayString();

  const byDate = new Map<string, CalendarDay>();
  for (const d of q.data?.days ?? []) byDate.set(d.date, d);
  const workoutDays = (q.data?.days ?? []).filter(
    (d) => d.status === 'workout',
  ).length;

  const colors = { workout: t.primary, rest: t.muted, sick: t.warn };

  function open(day: CalendarDay) {
    if (day.status === 'workout') {
      router.push(`/entry/${day.entry_id}`);
      return;
    }
    confirmDelete(
      `Usunąć wpis „${STATUS_LABEL[day.status]}”?`,
      () => del.mutate(day.entry_id),
      formatDay(day.date),
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Poprzedni miesiąc"
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
          hitSlop={12}
        >
          <Text style={[s.arrow, { color: t.text }]}>‹</Text>
        </Pressable>
        <Text style={[s.month, { color: t.text }]}>{monthLabel(month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Następny miesiąc"
          accessibilityState={{ disabled: month >= current }}
          disabled={month >= current}
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
          hitSlop={12}
        >
          <Text
            style={[
              s.arrow,
              { color: t.text, opacity: month >= current ? 0.25 : 1 },
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      <View style={s.row}>
        {WEEKDAYS_SHORT.map((w) => (
          <Text key={w} style={[s.head, { color: t.muted }]}>
            {w}
          </Text>
        ))}
      </View>

      {monthGrid(month).map((week, i) => (
        <View key={i} style={s.row}>
          {week.map((n, j) => {
            if (n === null) return <View key={j} style={s.cell} />;
            const date = dayOf(month, n);
            const entry = byDate.get(date);
            const isToday = date === today;
            const bg = entry ? colors[entry.status] : 'transparent';
            return (
              <View key={j} style={s.cell}>
                <Pressable
                  accessibilityRole={entry ? 'button' : undefined}
                  accessibilityLabel={
                    entry
                      ? `${n}: ${STATUS_LABEL[entry.status]}`
                      : `${n}`
                  }
                  disabled={!entry}
                  onPress={entry ? () => open(entry) : undefined}
                  style={[
                    s.day,
                    {
                      backgroundColor: bg,
                      borderColor: isToday ? t.text : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: entry
                        ? entry.status === 'workout'
                          ? t.onPrimary
                          : t.bg
                        : t.text,
                      fontWeight: isToday ? '800' : '500',
                    }}
                  >
                    {n}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}

      {q.isLoading && <ActivityIndicator color={t.primary} />}
      {q.isError && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.danger }}>
            Nie udało się wczytać kalendarza.
          </Text>
          <Button title="Spróbuj ponownie" onPress={() => q.refetch()} />
        </View>
      )}

      <View style={s.legend}>
        {(['workout', 'rest', 'sick'] as const).map((k) => (
          <View key={k} style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: colors[k] }]} />
            <Text style={{ color: t.muted }}>{STATUS_LABEL[k]}</Text>
          </View>
        ))}
      </View>
      {q.data && (
        <Text style={{ color: t.text, fontWeight: '600' }}>
          W tym miesiącu: {workoutDays}{' '}
          {workoutDays === 1 ? 'dzień' : 'dni'} z treningiem
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  arrow: { fontSize: 28, paddingHorizontal: 12 },
  month: { fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  row: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontSize: 12 },
  cell: { flex: 1, aspectRatio: 1, padding: 2 },
  day: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 2,
  },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
