import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MAX_PHOTOS, pickPhotos } from '@/api/photos';
import {
  useCategories,
  useDeleteWorkout,
  useUpdateWorkout,
  useUploadPhoto,
} from '@/api/queries';
import { useEntry } from '@/api/social';
import type { Workout } from '@/api/types';
import { PhotoStrip, useConfirmDeletePhoto } from '@/components/WorkoutCard';
import { confirmDelete } from '@/confirm';
import { describeError, shortUri } from '@/format';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function EditWorkoutScreen() {
  const { id, entry: entryId } = useLocalSearchParams<{
    id: string;
    entry?: string;
  }>();
  const t = useTheme();
  const entry = useEntry(entryId ?? '', !!entryId);
  const workout = entry.data?.workouts.find((w) => w.id === id);

  if (entry.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (!workout) {
    return (
      <View style={[s.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.danger }}>Nie znaleziono tego treningu.</Text>
      </View>
    );
  }
  return <Form workout={workout} />;
}

function Form({ workout }: { workout: Workout }) {
  const t = useTheme();
  const router = useRouter();
  const categories = useCategories();
  const update = useUpdateWorkout();
  const del = useDeleteWorkout();
  const upload = useUploadPhoto();
  const confirmDeletePhoto = useConfirmDeletePhoto();
  const [categoryId, setCategoryId] = useState(workout.category.id);
  const [description, setDescription] = useState(workout.description ?? '');
  const [uploading, setUploading] = useState(false);
  const room = MAX_PHOTOS - workout.photos.length;

  async function addPhotos(source: 'camera' | 'gallery') {
    const uris = await pickPhotos(source, room);
    if (uris.length === 0) return;
    setUploading(true);
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
    setUploading(false);
    if (failed) {
      Alert.alert(
        `Nie wysłano zdjęć: ${failed} z ${uris.length}`,
        firstError,
      );
    }
  }

  async function save() {
    try {
      await update.mutateAsync({ id: workout.id, categoryId, description });
      router.back();
    } catch {
      // error text below; the form keeps what was typed
    }
  }

  function remove() {
    confirmDelete(
      'Usunąć trening?',
      async () => {
        try {
          await del.mutateAsync(workout.id);
          router.back();
        } catch {
          // error text below
        }
      },
      'Zdjęcia też zostaną usunięte. Tego nie da się cofnąć.',
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[s.label, { color: t.text }]}>Rodzaj treningu</Text>
      <View style={s.chips}>
        {categories.data?.map((c) => {
          const active = c.id === categoryId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              style={[
                s.chip,
                { backgroundColor: active ? t.primary : t.card },
              ]}
            >
              <Text style={{ color: active ? t.onPrimary : t.text }}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[s.label, { color: t.text }]}>Opis (opcjonalnie)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        multiline
        placeholder="Np. 5 km po pracy"
        placeholderTextColor={t.muted}
        style={[s.input, { backgroundColor: t.card, color: t.text }]}
      />

      <Text style={[s.label, { color: t.text }]}>
        Zdjęcia ({workout.photos.length}/{MAX_PHOTOS})
      </Text>
      <PhotoStrip workout={workout} onDeletePhoto={confirmDeletePhoto} />
      {room > 0 && (
        <View style={s.row}>
          <Button
            title="Aparat"
            variant="secondary"
            style={s.flex}
            loading={uploading}
            onPress={() => addPhotos('camera')}
          />
          <Button
            title="Galeria"
            variant="secondary"
            style={s.flex}
            disabled={uploading}
            onPress={() => addPhotos('gallery')}
          />
        </View>
      )}

      {(update.isError || del.isError) && (
        <Text style={{ color: t.danger }}>
          {describeError(update.error ?? del.error)}
        </Text>
      )}
      <Button title="Zapisz zmiany" onPress={save} loading={update.isPending} />
      <Button
        title="Usuń trening"
        variant="danger"
        onPress={remove}
        loading={del.isPending}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  label: { fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  input: { borderRadius: 12, padding: 10, minHeight: 70, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
