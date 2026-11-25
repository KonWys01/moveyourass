import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { Photo } from '@/api/types';
import { describeError } from '@/format';
import { savePhoto } from '@/savePhoto';

import { ZoomableImage } from './ZoomableImage';

type SaveState = 'idle' | 'saving' | 'saved' | { error: string };

/**
 * Full-screen gallery: swipe sideways between the photos, pinch or
 * double tap to zoom, save the current photo to the phone.
 */
export function PhotoViewer({
  photos,
  startIndex,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const [save, setSave] = useState<SaveState>('idle');
  const current = photos[index];

  async function download() {
    if (!current?.url || save === 'saving') return;
    setSave('saving');
    try {
      const result = await savePhoto(current.url, current.id);
      setSave(result === 'saved' ? 'saved' : 'idle');
    } catch (e) {
      setSave({ error: describeError(e) });
    }
  }

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          onMomentumScrollEnd={(e) => {
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
            setSave('idle');
          }}
          renderItem={({ item }) => (
            <View style={[s.page, { width }]}>
              <ZoomableImage
                uri={item.url ?? ''}
                width={width}
                height={height}
                onZoomChange={setZoomed}
              />
            </View>
          )}
        />
        <Text style={s.counter}>
          {index + 1}/{photos.length}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          onPress={onClose}
          style={[s.round, s.close]}
          hitSlop={12}
        >
          <Text style={s.icon}>✕</Text>
        </Pressable>

        <View style={s.bottom}>
          {save === 'saved' && <Text style={s.note}>Zapisano w telefonie</Text>}
          {typeof save === 'object' && (
            <Text style={s.note}>Nie udało się zapisać: {save.error}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zapisz zdjęcie"
            onPress={download}
            disabled={!current?.url}
            style={s.saveButton}
            hitSlop={8}
          >
            {save === 'saving' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveText}>↓ Zapisz</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  page: { overflow: 'hidden', justifyContent: 'center' },
  counter: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  round: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { top: 44, right: 16 },
  icon: { color: '#fff', fontSize: 20 },
  bottom: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 10,
  },
  note: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
  },
  saveButton: {
    minWidth: 120,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
