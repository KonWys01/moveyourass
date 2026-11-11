import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDeletePhoto } from '@/api/queries';
import type { Workout } from '@/api/types';
import { confirmDelete } from '@/confirm';
import { useTheme } from '@/theme';

import { PhotoViewer } from './PhotoViewer';

/**
 * Thumbnails; a tap opens the full-screen viewer. With `onDeletePhoto`
 * every thumbnail also gets a visible ✕ (not a hidden long-press).
 */
export function PhotoStrip({
  workout,
  onDeletePhoto,
}: {
  workout: Workout;
  onDeletePhoto?: (photoId: string) => void;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const photos = workout.photos.filter((p) => p.url);
  if (photos.length === 0) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.row}>
          {photos.map((p, i) => (
            <View key={p.id}>
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Powiększ zdjęcie"
                onPress={() => setViewing(i)}
              >
                <Image
                  source={{ uri: p.url ?? undefined }}
                  style={s.photo}
                  accessibilityLabel="Zdjęcie z treningu"
                />
              </Pressable>
              {onDeletePhoto && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Usuń zdjęcie"
                  onPress={() => onDeletePhoto(p.id)}
                  style={s.remove}
                  hitSlop={8}
                >
                  <Text style={s.removeText}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
      {viewing !== null && (
        <PhotoViewer
          photos={photos}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

/** Confirmation + delete; shared by every place that lists own photos. */
export function useConfirmDeletePhoto() {
  const del = useDeletePhoto();
  return (photoId: string) =>
    confirmDelete('Usunąć zdjęcie?', () => del.mutate(photoId));
}

export function EditWorkoutButton({
  workoutId,
  entryId,
}: {
  workoutId: string;
  entryId: string;
}) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Edytuj trening"
      onPress={() => router.push(`/edit-workout/${workoutId}?entry=${entryId}`)}
      hitSlop={8}
    >
      <Text style={{ color: t.primary, fontWeight: '600' }}>Edytuj</Text>
    </Pressable>
  );
}

export function WorkoutCard({
  workout,
  entryId,
  editable,
  footer,
}: {
  workout: Workout;
  entryId?: string;
  editable?: boolean;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const confirmDeletePhoto = useConfirmDeletePhoto();
  return (
    <View style={[s.card, { backgroundColor: t.card }]}>
      <View style={s.titleRow}>
        <Text style={[s.title, { color: t.text }]}>
          {workout.category.name}
        </Text>
        {editable && entryId && (
          <EditWorkoutButton workoutId={workout.id} entryId={entryId} />
        )}
      </View>
      {workout.description ? (
        <Text style={{ color: t.muted }}>{workout.description}</Text>
      ) : null}
      <PhotoStrip
        workout={workout}
        onDeletePhoto={editable ? confirmDeletePhoto : undefined}
      />
      {footer}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, gap: 8 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  photo: { width: 120, height: 120, borderRadius: 10 },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 14 },
});
