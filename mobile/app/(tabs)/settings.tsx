import * as Application from 'expo-application';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  NOTIF_LABELS,
  useDeleteAccount,
  useNotifPrefs,
  useSetNotifPref,
  useUpdateProfile,
} from '@/api/settings';
import { useVersion } from '@/api/version';
import { useSession } from '@/auth/session';
import { fullName } from '@/components/Avatar';
import { UpdateButton } from '@/components/UpdateButton';
import { API_URL } from '@/config';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function Settings() {
  const t = useTheme();
  const { user, signOut } = useSession();
  const prefs = useNotifPrefs();
  const setPref = useSetNotifPref();
  const update = useUpdateProfile();
  const del = useDeleteAccount();
  const version = useVersion().data;

  if (!user) return null;

  function confirmDelete() {
    Alert.alert(
      'Usunąć konto?',
      'Konto, wpisy i zdjęcia zostaną usunięte bezpowrotnie.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń konto',
          style: 'destructive',
          onPress: () => del.mutate(),
        },
      ],
    );
  }

  const threshold = user.streak_threshold;
  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={s.content}
    >
      <Text style={[s.name, { color: t.text }]}>{fullName(user)}</Text>
      <Text style={{ color: t.muted }}>{user.email}</Text>

      <Text style={[s.heading, { color: t.text }]}>Prywatność</Text>
      <View style={s.line}>
        <View style={s.flex}>
          <Text style={{ color: t.text }}>Profil publiczny</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {user.is_public
              ? 'Wszyscy widzą Twoje treningi.'
              : 'Tylko zaakceptowani obserwujący.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Profil publiczny"
          value={user.is_public}
          disabled={update.isPending}
          onValueChange={(v) => update.mutate({ is_public: v })}
        />
      </View>

      <Text style={[s.heading, { color: t.text }]}>Cel tygodniowy</Text>
      <View style={s.line}>
        <Text style={[s.flex, { color: t.text }]}>
          Dni z treningiem, żeby zaliczyć tydzień
        </Text>
        <Button
          title="−"
          variant="secondary"
          disabled={threshold <= 1 || update.isPending}
          onPress={() => update.mutate({ streak_threshold: threshold - 1 })}
        />
        <Text style={[s.value, { color: t.text }]}>{threshold}</Text>
        <Button
          title="+"
          variant="secondary"
          disabled={threshold >= 7 || update.isPending}
          onPress={() => update.mutate({ streak_threshold: threshold + 1 })}
        />
      </View>
      {update.isError && (
        <Text style={{ color: t.danger }}>{update.error.message}</Text>
      )}

      <Text style={[s.heading, { color: t.text }]}>Powiadomienia</Text>
      {NOTIF_LABELS.map(([kind, label]) => (
        <View key={kind} style={s.line}>
          <Text style={[s.flex, { color: t.text }]}>{label}</Text>
          <Switch
            accessibilityLabel={label}
            value={prefs.data?.[kind] ?? true}
            disabled={!prefs.data}
            onValueChange={(v) => setPref.mutate({ [kind]: v })}
          />
        </View>
      ))}

      <Text style={[s.heading, { color: t.text }]}>O aplikacji</Text>
      <Text style={{ color: t.muted }}>
        Wersja {Application.nativeApplicationVersion ?? '?'}
      </Text>
      {version?.update_available && version.download_url ? (
        <UpdateButton
          url={version.download_url}
          label={`Zainstaluj wersję ${version.latest_version}`}
        />
      ) : null}
      <Button
        title="Polityka prywatności"
        variant="secondary"
        onPress={() => void Linking.openURL(`${API_URL}/privacy`)}
      />
      <Button title="Wyloguj" variant="secondary" onPress={signOut} />
      <Button
        title="Usuń konto"
        variant="danger"
        loading={del.isPending}
        onPress={confirmDelete}
      />
      {del.isError && (
        <Text style={{ color: t.danger }}>{del.error.message}</Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  name: { fontSize: 22, fontWeight: '800' },
  heading: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  value: { fontSize: 18, fontWeight: '700', minWidth: 20, textAlign: 'center' },
});
