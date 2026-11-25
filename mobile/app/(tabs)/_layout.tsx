import { Tabs } from 'expo-router';
import { TabIcon } from '@/components/TabIcon';
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
            // drawn with Views: nothing to load, so no "missing icon" boxes
            tabBarIcon: ({ color }) => (
              <TabIcon name={tab.icon} color={color} background={t.bg} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
