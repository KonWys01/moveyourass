import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { useVersion } from '@/api/version';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

/** Blocks the app when the server says this version is too old. */
export function UpdateGate({ children }: { children: ReactNode }) {
  const t = useTheme();
  const version = useVersion();
  const v = version.data;
  // Network error / no data: never lock the user out because of it.
  if (!v?.update_required) return <>{children}</>;
  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <Text style={[s.title, { color: t.text }]}>
        Wymagana aktualizacja
      </Text>
      <Text style={{ color: t.muted, fontSize: 16 }}>
        Ta wersja aplikacji ({v.current_version}) jest za stara. Pobierz
        wersję {v.latest_version}, żeby dalej korzystać.
      </Text>
      {v.download_url ? (
        <Button
          title="Pobierz aktualizację"
          onPress={() => void Linking.openURL(v.download_url)}
        />
      ) : null}
    </View>
  );
}

export function UpdateBanner() {
  const t = useTheme();
  const v = useVersion().data;
  if (!v?.update_available || v.update_required) return null;
  return (
    <View style={[s.banner, { backgroundColor: t.card }]}>
      <Text style={{ color: t.text, flex: 1 }}>
        Dostępna nowa wersja {v.latest_version}.
      </Text>
      {v.download_url ? (
        <Button
          title="Pobierz"
          variant="secondary"
          onPress={() => void Linking.openURL(v.download_url)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '800' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    padding: 12,
  },
});
