import { Image, StyleSheet, Text, View } from 'react-native';

import type { UserBrief } from '@/api/types';
import { useTheme } from '@/theme';

export function fullName(u: Pick<UserBrief, 'first_name' | 'last_name'>) {
  return `${u.first_name} ${u.last_name}`.trim();
}

export function Avatar({ user, size = 40 }: { user: UserBrief; size?: number }) {
  const t = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (user.avatar_url) {
    return <Image source={{ uri: user.avatar_url }} style={box} />;
  }
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`;
  return (
    <View style={[box, s.fallback, { backgroundColor: t.border }]}>
      <Text style={{ color: t.text, fontWeight: '700' }}>
        {initials.toUpperCase()}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
