import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
} from 'react-native';

import { type ChangelogEntry, loadUnseen, markSeen } from '@/changelog';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

const BOTTOM_SLACK = 16;

export function reachedBottom(e: NativeScrollEvent): boolean {
  return (
    e.contentOffset.y + e.layoutMeasurement.height >=
    e.contentSize.height - BOTTOM_SLACK
  );
}

/** Mounted for signed-in users: shows what changed after an update. */
export function WhatsNew() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    let alive = true;
    void loadUnseen().then((e) => alive && setEntries(e));
    return () => {
      alive = false;
    };
  }, []);

  if (entries.length === 0) return null;
  return (
    <WhatsNewModal
      entries={entries}
      onClose={() => {
        setEntries([]);
        void markSeen();
      }}
    />
  );
}

/**
 * Can be closed only after scrolling to the end of the list; when it all
 * fits on screen, right away.
 */
export function WhatsNewModal({
  entries,
  onClose,
}: {
  entries: ChangelogEntry[];
  onClose: () => void;
}) {
  const t = useTheme();
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const fits = viewport > 0 && content > 0 && content <= viewport + BOTTOM_SLACK;
  const canClose = fits || scrolledToEnd;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android back closes it only when the button would
      onRequestClose={() => {
        if (canClose) onClose();
      }}
    >
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: t.bg, borderColor: t.border }]}>
          <Text style={[s.title, { color: t.text }]}>Co nowego</Text>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.list}
            onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
            onContentSizeChange={(_w, h) => setContent(h)}
            onScroll={(e) => {
              if (reachedBottom(e.nativeEvent)) setScrolledToEnd(true);
            }}
            scrollEventThrottle={100}
            testID="whats-new-scroll"
          >
            {entries.map((entry) => (
              <View key={entry.id} style={s.list}>
                {entries.length > 1 && (
                  <Text style={[s.section, { color: t.text }]}>
                    {entry.title}
                  </Text>
                )}
                {entry.items.map((item, i) => (
                  <View key={i} style={s.item}>
                    <Text style={{ color: t.primary }}>•</Text>
                    <Text style={[s.itemText, { color: t.text }]}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          {!canClose && (
            <Text style={[s.hint, { color: t.muted }]}>
              Przewiń do końca, żeby zamknąć
            </Text>
          )}
          <Button title="Zamknij" onPress={onClose} disabled={!canClose} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    maxHeight: '85%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800' },
  scroll: { flexGrow: 0 },
  list: { gap: 10 },
  section: { fontSize: 16, fontWeight: '700' },
  item: { flexDirection: 'row', gap: 8 },
  itemText: { flex: 1, fontSize: 15, lineHeight: 21 },
  hint: { textAlign: 'center', fontSize: 13 },
});
