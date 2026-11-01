# MoveYourAss — projekt aplikacji

Data: 2026-11-01

Legenda: **[ustalone]** — decyzja właściciela projektu; **[moja decyzja]** —
założenie autora tego dokumentu, do poprawienia; **[dla wykonawcy]** — celowo
zostawione wykonawcy.

## 1. Cel i powód

Aplikacja mobilna do codziennego motywowania się do ruchu, w stylu BeReal:
raz dziennie przychodzi powiadomienie, a użytkownik potwierdza trening
zdjęciem (albo oznacza odpoczynek lub chorobę). Znajomi widzą swoje zdjęcia
na wspólnej tablicy, mogą je lajkować i komentować.

Na start korzystają z niej dwie osoby (autor i jego brat). Autor dopuszcza,
że z czasem użytkowników może przybyć, ale **nie projektujemy pod skalę**.

**Sukces [ustalone]:** aplikacja jest użyteczna na co dzień dla tych dwóch
osób. Koszty nie są ograniczeniem (serwer i domena już istnieją).

## 2. Cele, nie-cele, anty-cele

**Cele**
- Jeden wpis dziennie (lub kilka treningów) z potwierdzeniem zdjęciem.
- Tygodniowy streak, historia, obserwowanie osób, tablica, lajki, komentarze.
- Logowanie Google, powiadomienia push, panel administracyjny.
- Dystrybucja Androida bez sklepów.

**Nie-cele [ustalone / moja decyzja]**
- Sklepy Google Play i App Store (nie chcemy płacić) — **iOS na razie poza
  zakresem** [ustalone, bo wymaga płatnego konta Apple].
- Integracja z zegarkami/Garmin/Strava (czas aktywności nie jest czytany;
  dzień wskazuje użytkownik) [moja decyzja].
- Optymalizacja pod dużą skalę [ustalone przez zakres: dwie osoby].
- Kod zaproszenia dla znajomych — odrzucony [ustalone].

**Anty-cele [moja decyzja]**
- Presja społeczna: brak listy „kto dziś nie trenował”, pokazujemy tylko
  pozytywy.
- Skomplikowanie ponad potrzeby dwóch osób.

## 3. Ograniczenia i stos [ustalone, chyba że zaznaczono]

- **Backend:** FastAPI, asynchronicznie.
- **Baza:** Supabase (Postgres). **[moja decyzja]** dostęp przez async
  SQLAlchemy (wymagane przez SQLAdmin).
- **Zdjęcia:** Supabase Storage **[moja decyzja]**.
- **Aplikacja mobilna:** React Native; **[moja decyzja]** Expo.
- **Push:** Firebase (FCM).
- **Panel admina:** SQLAdmin wpięty w backend, bez osobnego frontendu.
- **Repo:** jedno repo (`backend/`, `mobile/`, `docker-compose.yml`,
  `Caddyfile`, `docs/`). Caddy odpowiada za adresy, docker-compose za
  uruchamianie kontenerów. Aplikacja mobilna nie jest kontenerem.
- **Wdrożenie backendu:** serwer i domena istnieją; wzorzec z repo CV
  (obrazy w ghcr.io, rolling restart bez przestoju) można przenieść
  [moja sugestia].
- **Platforma na start:** tylko Android.

## 4. Konta i logowanie

- Logowanie wyłącznie przez Google [ustalone]. Przy pierwszym logowaniu
  pobieramy imię, nazwisko, e-mail i zdjęcie profilowe.
- Przy pierwszym logowaniu użytkownik wybiera profil **publiczny** lub
  **prywatny**; domyślnie publiczny [ustalone].
- Te same konta służą do panelu admina. Role (kto jest adminem i kto ma
  dostęp do panelu) są przechowywane w bazie i nadawane z panelu [ustalone].
- Mechanizm uwierzytelniania (Supabase Auth z Google czy własna weryfikacja
  tokenu Google w FastAPI) — [dla wykonawcy], pod warunkiem, że panel i
  aplikacja używają tych samych kont.

## 5. Wpis dnia

- Dla każdego dnia użytkownik ma jeden z trzech statusów: **trening**,
  **odpoczynek**, **chory** [ustalone].
- W jednym dniu może być **wiele treningów**; każdy trening może mieć
  **wiele zdjęć** [ustalone]. **[moja decyzja]** każdy trening ma kategorię,
  opcjonalny opis i maksymalnie ok. 5 zdjęć.
- Zdjęcie robione aparatem w aplikacji **albo** wybierane z galerii
  [ustalone]. Data EXIF nie ma znaczenia [moja decyzja].
- **Kategorie treningu:** bieganie, rower, pływanie, ćwiczenia w domu,
  spacer, siłownia, siłownia plenerowa itp. [ustalone]. **[moja decyzja]**
  to lista w bazie edytowalna w panelu admina, nie stała w kodzie.
- **Odpoczynek:** aplikacja pokazuje komunikat, jeśli od kilku dni nie było
  treningu (próg dni — [dla wykonawcy]) [ustalone].
- Jeśli dzień oznaczono jako odpoczynek, a potem dodano trening, **trening
  ma pierwszeństwo** [moja decyzja].

### Do którego dnia należy wpis [ustalone, szczegóły: moja decyzja]
- Dzień kalendarzowy w strefie czasowej użytkownika, domyślnie „dziś”.
- Wpisy dodawane **tylko za dziś**, z buforem po północy: między 00:00 a
  01:00 (stała, łatwa do zmiany) wpis **automatycznie** liczy się za
  poprzedni dzień i użytkownik **nie widzi wyboru**. Aplikacja może pokazać
  niedotykalny podpis typu „zaliczone za: poniedziałek”.
- Po 01:00 jest tylko „dziś”. Nie da się dodać wpisu za dawniejsze dni.

## 6. Streak tygodniowy [ustalone]

- Tydzień trwa od poniedziałku do niedzieli w strefie użytkownika.
- Tydzień jest zaliczony, gdy liczba **dni z co najmniej jednym treningiem**
  osiągnie próg. Dwa treningi jednego dnia liczą się jako jeden dzień.
- Próg domyślnie wynosi **1**. **[moja decyzja]** użytkownik może go zmienić
  w ustawieniach.
- Streak = liczba kolejnych zaliczonych tygodni.
- Odpoczynek jest neutralny (nie łamie, nie zwiększa). Choroba **zamraża**
  streak (tydzień z oznaczeniem „chory” go nie łamie).
- Przy imieniu na tablicy i na liście znajomych widać streak i postęp
  bieżącego tygodnia (np. „2 z 3”).

## 7. Obserwowanie i tablica

- Model jednostronny, jak na Instagramie/Stravie [ustalone]:
  - wyszukiwanie osób po nazwie działa zawsze;
  - **profil publiczny:** obserwowanie aktywuje się od razu;
  - **profil prywatny:** wymaga akceptacji właściciela; do tego czasu widać
    tylko nazwę i zdjęcie profilowe;
  - w wyszukiwarce profile prywatne mają ikonę kłódki.
- Tablica pokazuje wpisy osób, które użytkownik obserwuje.
- **Widoczność [ustalone]:** profil publiczny widzi każdy, razem z historią,
  lajkami i komentarzami; lajkować i komentować może każdy zalogowany.
  Profil prywatny widzą tylko zaakceptowani obserwujący.
- Lajki i komentarze pod wpisami [ustalone]. **[moja decyzja]** komentarze
  są płaskie (bez wątków); szczegóły (usuwanie własnych, moderacja) —
  [dla wykonawcy] w granicach tego dokumentu.
- Historia: użytkownik przegląda własne wpisy [ustalone].

## 8. Powiadomienia

- **Codzienne przypomnienie około 20:00** (czas lokalny użytkownika),
  informujące, czy dziś jest już wpis, i zachęcające do potwierdzenia
  zdjęciem [ustalone]. **[moja decyzja]** nie wysyłamy go, jeśli wpis na
  dziś już istnieje.
- Powiadomienia o: polubieniu, komentarzu, prośbie o obserwowanie
  [ustalone]. **[moja decyzja]** także: ktoś zaczął obserwować (profil
  publiczny), prośba zaakceptowana.
- Użytkownik w ustawieniach włącza/wyłącza każdy rodzaj osobno [ustalone];
  **[moja decyzja]** to dotyczy też codziennego przypomnienia.

## 9. Dystrybucja i aktualizacje (Android) [ustalone]

- Bez sklepów: plik APK budowany przez CI i publikowany pod stałym
  adresem (**[moja decyzja]**: GitHub Releases).
- Backend ma endpoint sprawdzający wersję aplikacji. Aplikacja informuje,
  że jest nieaktualna, i podaje link do pobrania. Instalacja z poziomu
  aplikacji (pobranie APK i systemowy instalator) jest dopuszczalna, wymaga
  zgody użytkownika na instalację z nieznanych źródeł.
- Szczegóły (minimalna vs najnowsza wersja, wymuszenie aktualizacji) —
  [dla wykonawcy].

## 10. Panel administracyjny [ustalone]

- SQLAdmin, wpięty w backend FastAPI, logowanie tymi samymi kontami Google.
- Pełny podgląd i edycja danych wszystkich modeli (użytkownicy, wpisy,
  komentarze, kategorie, role) w stylu admina Django.
- **[moja decyzja]** moderacja: usuwanie zdjęć i komentarzy, blokowanie
  użytkowników.

## 11. Dodatkowe decyzje (uzupełnione po przeglądzie dokumentu)

- **Rejestracja otwarta [ustalone]:** zalogować się może każde konto
  Google („każdy może się zalogować przez SSO”). Wykonawca ustawia ekran
  zgody Google tak, aby nie ograniczał logowania do wąskiej listy testerów
  (tryb produkcyjny; zakresy podstawowe: e-mail, profil), i przygotowuje
  prostą politykę prywatności.
- **Pierwszy admin [moja decyzja]:** adres e-mail pierwszego admina
  w zmiennej środowiskowej; konto z tym adresem dostaje rolę admina przy
  pierwszym logowaniu. Kolejne role nadaje się z panelu.
- **Strefa czasowa [moja decyzja]:** użytkownik ma w profilu zapisaną
  strefę (IANA), aplikacja odświeża ją, gdy się zmieni. Serwer sam liczy
  „dziś”, bufor po północy, tygodnie i streak. Zegar telefonu nie jest
  zaufanym źródłem daty.
- **Prywatność zdjęć [moja decyzja]:** ścisła. Prywatny bucket w Supabase
  Storage, adresy podpisane (signed URL) wydawane przez backend po
  sprawdzeniu uprawnień. Dotyczy zdjęć profili prywatnych i wpisów.
- **Wersja aplikacji [moja decyzja]:** minimalna i najnowsza wersja w
  tabeli edytowalnej w panelu admina; aplikacja wysyła swoją wersję w
  nagłówku. W wersji 1 aplikacja pokazuje link do pobrania; instalacja z
  poziomu aplikacji jest odłożona na później.
- **Budowanie aplikacji [moja decyzja]:** lokalne buildy w GitHub Actions
  (Expo z development buildem), bez chmury EAS.
- **Lajki i komentarze:** powiadomienia dostaje właściciel wpisu
  [moja decyzja]. Kto może lajkować i komentować — patrz pkt 7.

## 12. Zostawione wykonawcy

Schemat bazy, kształt API, sposób uwierzytelniania opisany w pkt 4,
przetwarzanie i rozmiar zdjęć, paginacja tablicy, limity zapytań,
harmonogram wysyłki pushy w różnych strefach czasowych, projekt ekranów,
polityka prywatności i usuwanie konta (jeśli wymagane przez Google/Meta),
organizacja CI/CD.

## 13. Kolejność prac [moja propozycja]

To trzy powiązane, ale osobne części: backend z panelem, aplikacja mobilna,
dystrybucja/CI. Sugeruję zacząć od backendu z panelem (logowanie, model
danych, wpisy, streak), potem aplikacja mobilna, na końcu dystrybucja APK.
