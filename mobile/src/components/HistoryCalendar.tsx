import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCalendar, useDeleteEntry } from '@/api/queries';
import type { CalendarDay } from '@/api/types';
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

  function addWorkout(date: string) {
    router.push(
      date === today ? '/add-workout' : `/add-workout?date=${date}`,
    );
  }

  function open(day: CalendarDay) {
    if (day.status === 'workout') {
      router.push(`/entry/${day.entry_id}`);
      return;
    }
    // rest/sick: delete it, or turn the day into a workout day
    Alert.alert(`${STATUS_LABEL[day.status]}`, formatDay(day.date), [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: () => del.mutate(day.entry_id),
      },
      { text: 'Dodaj trening', onPress: () => addWorkout(day.date) },
    ]);
  }

  function openEmpty(date: string) {
    Alert.alert('Dodać trening?', formatDay(date), [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Dodaj trening', onPress: () => addWorkout(date) },
    ]);
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
            const isFuture = date > today;
            const bg = entry ? colors[entry.status] : 'transparent';
            return (
              <View key={j} style={s.cell}>
                <Pressable
                  accessibilityRole={isFuture ? undefined : 'button'}
                  accessibilityLabel={
                    entry
                      ? `${n}: ${STATUS_LABEL[entry.status]}`
                      : `${n}`
                  }
                  disabled={isFuture}
                  onPress={
                    entry ? () => open(entry) : () => openEmpty(date)
                  }
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
