import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MAX_PHOTOS, pickPhotos } from '@/api/photos';
import { useAddWorkout, useCategories } from '@/api/queries';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function AddWorkout() {
  const t = useTheme();
  const router = useRouter();
  const categories = useCategories();
  const add = useAddWorkout();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  async function pick(source: 'camera' | 'gallery') {
    const uris = await pickPhotos(source, MAX_PHOTOS - photos.length);
    setPhotos((cur) => [...cur, ...uris].slice(0, MAX_PHOTOS));
  }

  async function submit() {
    if (categoryId === null) return;
    try {
      const { failed } = await add.mutateAsync({
        categoryId,
        description,
        photoUris: photos,
      });
      if (failed) {
        Alert.alert(
          'Trening zapisany',
          `Nie udało się wysłać zdjęć: ${failed}. Dodasz je później z ekranu Dziś.`,
        );
      }
      router.back();
    } catch {
      // error text rendered below; the form keeps its content
    }
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
                {
                  backgroundColor: active ? t.primary : t.card,
                },
              ]}
            >
              <Text style={{ color: active ? t.onPrimary : t.text }}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {categories.isError && (
        <Text style={{ color: t.danger }}>
          Nie udało się wczytać kategorii.
        </Text>
      )}

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
        Zdjęcia ({photos.length}/{MAX_PHOTOS})
      </Text>
      <View style={s.chips}>
        {photos.map((uri) => (
          <Pressable
            key={uri}
            onPress={() => setPhotos((c) => c.filter((u) => u !== uri))}
          >
            <Image source={{ uri }} style={s.photo} />
          </Pressable>
        ))}
      </View>
      {photos.length > 0 && (
        <Text style={{ color: t.muted }}>
          Dotknij zdjęcia, żeby je usunąć.
        </Text>
      )}
      {photos.length < MAX_PHOTOS && (
        <View style={s.row}>
          <Button
            title="Aparat"
            variant="secondary"
            style={s.flex}
            onPress={() => pick('camera')}
          />
          <Button
            title="Galeria"
            variant="secondary"
            style={s.flex}
            onPress={() => pick('gallery')}
          />
        </View>
      )}

      {add.isError && (
        <Text style={{ color: t.danger }}>{add.error.message}</Text>
      )}
      <Button
        title="Zapisz trening"
        onPress={submit}
        loading={add.isPending}
        disabled={categoryId === null}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  label: { fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  input: { borderRadius: 12, padding: 12, minHeight: 70, fontSize: 16 },
  photo: { width: 90, height: 90, borderRadius: 10 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
