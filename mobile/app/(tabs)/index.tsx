import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui';

export default function Today() {
  const { user, signOut } = useSession();
  const t = useTheme();
  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.text, fontSize: 18 }}>
        Zalogowano jako {user?.first_name}.
      </Text>
      <Button title="Wyloguj" variant="secondary" onPress={signOut} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
});
