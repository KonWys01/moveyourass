import { useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from '@/ui';
import {
  installUpdate,
  openInstallPermissionSettings,
  progressLabel,
  type DownloadProgress,
} from '@/update';

type Phase = 'idle' | 'downloading' | 'installing' | 'error';

/** Downloads the new APK and opens Android's installer. */
export function UpdateButton({
  url,
  label = 'Zainstaluj aktualizację',
}: {
  url: string;
  label?: string;
}) {
  const t = useTheme();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);
  const running = useRef(false);

  async function start() {
    if (running.current) return; // double tap
    running.current = true;
    setError('');
    setProgress(null);
    setPhase('downloading');
    try {
      await installUpdate(url, setProgress, () => setPhase('installing'));
      // installer closed without replacing the app (cancelled / blocked)
      setTried(true);
      setPhase('idle');
    } catch (e) {
      console.warn('app update failed', e);
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    } finally {
      running.current = false;
    }
  }

  const busy = phase === 'downloading' || phase === 'installing';
  return (
    <View style={s.box}>
      <Button
        title={
          phase === 'downloading'
            ? progressLabel(progress)
            : phase === 'installing'
              ? 'Otwieranie instalatora…'
              : phase === 'error'
                ? 'Spróbuj ponownie'
                : label
        }
        onPress={() => void start()}
        loading={false}
        disabled={busy || !url}
      />
      {phase === 'error' && (
        <Text style={{ color: t.danger }}>Nie udało się: {error}</Text>
      )}
      {(phase === 'error' || tried) && (
        <>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Jeśli instalator się nie pokazał, zezwól tej aplikacji na
            instalowanie aplikacji z nieznanych źródeł i spróbuj ponownie.
          </Text>
          <Button
            title="Zezwól na instalowanie"
            variant="secondary"
            onPress={() => void openInstallPermissionSettings()}
          />
          <Button
            title="Pobierz w przeglądarce"
            variant="secondary"
            onPress={() => void Linking.openURL(url)}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({ box: { gap: 8 } });
