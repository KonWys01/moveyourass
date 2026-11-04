import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { TABS } from '@/tabs';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        // default inactive colour is unreadable on the dark background
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            // emoji: nothing to load, so no "missing icon" boxes
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>
                {tab.icon}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
