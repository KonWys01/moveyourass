import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDeletePhoto } from '@/api/queries';
import type { Workout } from '@/api/types';
import { useTheme } from '@/theme';

export function PhotoStrip({
  workout,
  onLongPressPhoto,
}: {
  workout: Workout;
  onLongPressPhoto?: (photoId: string) => void;
}) {
  if (workout.photos.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.row}>
        {workout.photos.map((p) =>
          p.url ? (
            <Pressable
              key={p.id}
              onLongPress={
                onLongPressPhoto ? () => onLongPressPhoto(p.id) : undefined
              }
            >
              <Image
                source={{ uri: p.url }}
                style={s.photo}
                accessibilityLabel="Zdjęcie z treningu"
              />
            </Pressable>
          ) : null,
        )}
      </View>
    </ScrollView>
  );
}

export function WorkoutCard({
  workout,
  editable,
  footer,
}: {
  workout: Workout;
  editable?: boolean;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const del = useDeletePhoto();
  return (
    <View style={[s.card, { backgroundColor: t.card }]}>
      <Text style={[s.title, { color: t.text }]}>
        {workout.category.name}
      </Text>
      {workout.description ? (
        <Text style={{ color: t.muted }}>{workout.description}</Text>
      ) : null}
      <PhotoStrip
        workout={workout}
        onLongPressPhoto={
          editable
            ? (id) =>
                Alert.alert('Usunąć zdjęcie?', undefined, [
                  { text: 'Anuluj', style: 'cancel' },
                  {
                    text: 'Usuń',
                    style: 'destructive',
                    onPress: () => del.mutate(id),
                  },
                ])
            : undefined
        }
      />
      {footer}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  photo: { width: 120, height: 120, borderRadius: 10 },
});
