/** Single source of truth for the bottom tabs (name = file in app/(tabs)). */
export const TABS = [
  { name: 'index', title: 'Dziś', icon: '🏋️' },
  { name: 'feed', title: 'Tablica', icon: '📰' },
  { name: 'search', title: 'Szukaj', icon: '🔍' },
  { name: 'history', title: 'Historia', icon: '🗓️' },
  { name: 'settings', title: 'Ustawienia', icon: '⚙️' },
] as const;
