import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

/**
 * "Co nowego" shown once after an update. Add a NEW entry on top (next
 * id) with every release that users should hear about; ids only grow.
 * Not tied to version numbers, because those are assigned by CI.
 */
export type ChangelogEntry = { id: number; title: string; items: string[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 1,
    title: 'Nowości',
    items: [
      'Nowe, prostsze ikony na dolnym pasku.',
      'Zdjęcia: przybliżanie dwoma palcami lub podwójnym dotknięciem, przesuwanie przybliżonego zdjęcia.',
      'Zdjęcia: przycisk „Zapisz” zapisuje zdjęcie w telefonie (za pierwszym razem wybierasz folder).',
      'Powiadomienia o komentarzach dostają też osoby, które wcześniej komentowały ten wpis.',
      'Otwarty wpis sam odświeża komentarze, gdy przyjdzie powiadomienie.',
      'Pisanie komentarza: pole tekstowe przesuwa się nad klawiaturę.',
      'Trening za miniony dzień: w Historii → Kalendarz dotknij dnia i wybierz „Dodaj trening”. Dzień odpoczynku lub choroby też można zamienić na trening.',
      'Po aktualizacji pokazujemy takie podsumowanie zmian.',
    ],
  },
];

const SEEN_KEY = 'changelogSeen';
/** install vs update: Android keeps the first install time across updates */
const UPDATE_GAP_MS = 60 * 1000;

/** Entries newer than `seen`, newest first. Pure, for tests. */
export function unseenEntries(
  seen: number | null,
  isUpdate: boolean,
  log: ChangelogEntry[] = CHANGELOG,
): ChangelogEntry[] {
  const newest = Math.max(0, ...log.map((e) => e.id));
  if (seen === null) {
    // never stored: a fresh install sees nothing, someone who updated
    // from a version without this feature sees the latest notes
    return isUpdate ? log.filter((e) => e.id === newest) : [];
  }
  return log.filter((e) => e.id > seen).sort((a, b) => b.id - a.id);
}

async function wasUpdated(): Promise<boolean> {
  try {
    const [installed, updated] = await Promise.all([
      Application.getInstallationTimeAsync(),
      Application.getLastUpdateTimeAsync(),
    ]);
    return updated.getTime() - installed.getTime() > UPDATE_GAP_MS;
  } catch {
    return false;
  }
}

export async function loadUnseen(): Promise<ChangelogEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(SEEN_KEY);
    const seen = raw === null ? null : Number(raw);
    const entries = unseenEntries(
      Number.isFinite(seen) ? seen : null,
      seen === null ? await wasUpdated() : false,
    );
    if (entries.length === 0) await markSeen();
    return entries;
  } catch {
    return []; // never block the app because of release notes
  }
}

export async function markSeen(): Promise<void> {
  const newest = Math.max(0, ...CHANGELOG.map((e) => e.id));
  await SecureStore.setItemAsync(SEEN_KEY, String(newest)).catch(
    () => undefined,
  );
}
