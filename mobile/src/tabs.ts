import type { TabIconName } from '@/components/TabIcon';

/** Single source of truth for the bottom tabs (name = file in app/(tabs)). */
export const TABS: readonly { name: string; title: string; icon: TabIconName }[] =
  [
    { name: 'index', title: 'Dziś', icon: 'dumbbell' },
    { name: 'feed', title: 'Tablica', icon: 'feed' },
    { name: 'search', title: 'Szukaj', icon: 'search' },
    { name: 'history', title: 'Historia', icon: 'calendar' },
    { name: 'settings', title: 'Ustawienia', icon: 'sliders' },
  ];
