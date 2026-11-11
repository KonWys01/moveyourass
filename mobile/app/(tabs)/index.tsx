import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useDeleteEntry,
  useMarkDay,
  useToday,
  useUploadPhoto,
} from '@/api/queries';
import { MAX_PHOTOS, pickPhotos } from '@/api/photos';
import type { Workout } from '@/api/types';
import { confirmDelete } from '@/confirm';
import { UpdateBanner } from '@/components/UpdateGate';
import { WorkoutCard } from '@/components/WorkoutCard';
import {
  STATUS_LABEL,
  describeError,
  formatDay,
  localDayString,
  pluralDays,
  shortUri,
  weekdayName,
} from '@/format';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function Today() {
  const t = useTheme();
  const router = useRouter();
  const today = useToday();
  const mark = useMarkDay();
  const upload = useUploadPhoto();
  const delEntry = useDeleteEntry();
  const [busyWorkout, setBusyWorkout] = useState<string | null>(null);

  if (today.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (today.isError || !today.data) {
    return (
      <View style={[s.center, { backgroundColor: t.bg, gap: 12 }]}>
        <Text style={{ color: t.danger }}>
          Nie udało się wczytać danych.
        </Text>
        <Button title="Spróbuj ponownie" onPress={() => today.refetch()} />
      </View>
    );
  }

  const d = today.data;
  const status = d.entry?.status;
  // 00:00-01:00 the server counts entries for yesterday: say so.
  const countedForYesterday = d.date !== localDayString();

  async function addPhoto(workout: Workout, source: 'camera' | 'gallery') {
    const uris = await pickPhotos(source, MAX_PHOTOS - workout.photos.length);
    setBusyWorkout(workout.id);
    let failed = 0;
    let firstError = '';
    for (const uri of uris) {
      try {
        await upload.mutateAsync({ workoutId: workout.id, uri });
      } catch (e) {
        failed += 1;
        console.warn('photo upload failed', shortUri(uri), e);
        if (!firstError) {
          firstError = `${describeError(e)}\nPlik: ${shortUri(uri)}`;
        }
      }
    }
    setBusyWorkout(null);
    if (failed) {
      Alert.alert(
        `Nie wysłano zdjęć: ${failed} z ${uris.length}`,
        firstError,
      );
    }
  }

  function photoFooter(w: Workout) {
    if (w.photos.length >= MAX_PHOTOS) return null;
    return (
      <View style={s.row}>
        <Button
          title="Aparat"
          variant="secondary"
          loading={busyWorkout === w.id}
          onPress={() => addPhoto(w, 'camera')}
          style={s.flex}
        />
        <Button
          title="Galeria"
          variant="secondary"
          disabled={busyWorkout === w.id}
          onPress={() => addPhoto(w, 'gallery')}
          style={s.flex}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={today.isRefetching}
          onRefresh={() => {
            void today.refetch();
          }}
        />
      }
    >
      <UpdateBanner />
      <View style={[s.card, { backgroundColor: t.card }]}>
        <Text style={[s.big, { color: t.text }]}>
          Seria: {d.streak} {d.streak === 1 ? 'tydzień' : 'tyg.'}
        </Text>
        <Text style={{ color: t.muted }}>
          Ten tydzień: {d.week_progress} z {d.week_threshold}
        </Text>
      </View>

      <Text style={[s.day, { color: t.text }]}>{formatDay(d.date)}</Text>
      {countedForYesterday && (
        <Text style={{ color: t.muted }}>
          Zaliczone za: {weekdayName(d.date)}
        </Text>
      )}

      {d.show_rest_hint && (
        <View style={[s.card, { backgroundColor: t.card }]}>
          <Text style={{ color: t.text }}>
            {d.days_since_workout === null
              ? 'Jeszcze bez treningu. Zacznij od dziś!'
              : `Od ${pluralDays(d.days_since_workout)} bez treningu. Czas się ruszyć albo oznacz odpoczynek.`}
          </Text>
        </View>
      )}

      {status && status !== 'workout' && (
        <View style={[s.card, { backgroundColor: t.card }]}>
          <Text style={{ color: t.text }}>
            Dziś: {STATUS_LABEL[status]}
          </Text>
          {d.entry && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Usuń wpis dnia"
              disabled={delEntry.isPending}
              onPress={() =>
                confirmDelete(
                  `Usunąć wpis „${STATUS_LABEL[status]}”?`,
                  () => delEntry.mutate(d.entry!.id),
                )
              }
              hitSlop={8}
            >
              <Text style={{ color: t.danger, fontWeight: '600' }}>
                Usuń
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {d.entry?.workouts.map((w) => (
        <WorkoutCard
          key={w.id}
          workout={w}
          entryId={d.entry!.id}
          editable
          footer={photoFooter(w)}
        />
      ))}

      {d.entry && d.entry.workouts.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reakcje na dzisiejszy wpis"
          onPress={() => router.push(`/entry/${d.entry!.id}`)}
          style={s.reactions}
        >
          <Text style={{ color: t.muted, fontSize: 16 }}>
            ♥ {d.like_count ?? 0}
          </Text>
          <Text style={{ color: t.muted, fontSize: 16 }}>
            💬 {d.comment_count ?? 0}
          </Text>
        </Pressable>
      )}

      <Button
        title="Dodaj trening"
        onPress={() => router.push('/add-workout')}
      />
      {status !== 'workout' && (
        <View style={s.row}>
          <Button
            title="Odpoczynek"
            variant="secondary"
            style={s.flex}
            disabled={status === 'rest'}
            loading={mark.isPending && mark.variables === 'rest'}
            onPress={() => mark.mutate('rest')}
          />
          <Button
            title="Chory"
            variant="secondary"
            style={s.flex}
            disabled={status === 'sick'}
            loading={mark.isPending && mark.variables === 'sick'}
            onPress={() => mark.mutate('sick')}
          />
        </View>
      )}
      {mark.isError && (
        <Text style={{ color: t.danger }}>{mark.error.message}</Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 14, padding: 14, gap: 4 },
  big: { fontSize: 22, fontWeight: '800' },
  day: { fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  row: { flexDirection: 'row', gap: 8 },
  reactions: { flexDirection: 'row', gap: 24, paddingVertical: 4 },
  flex: { flex: 1 },
});
