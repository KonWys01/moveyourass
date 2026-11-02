# Wydawanie APK

Wydanie robi workflow `Release APK` (`.github/workflows/release-apk.yml`):

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Buduje podpisany APK i tworzy GitHub Release z plikami
`moveyourass-<wersja>.apk` oraz `moveyourass.apk` (stała nazwa).
`versionName` = numer z tagu, `versionCode` = numer przebiegu workflow
(rośnie, więc aktualizacja nad starą instalacją zawsze działa).

## Jednorazowa konfiguracja (Settings → Secrets and variables → Actions)

1. **Keystore** (zachowaj go na zawsze: zgubienie = nowa aplikacja, nikt nie
   zaktualizuje starej):
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias moveyourass \
     -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 release.keystore   # -> ANDROID_KEYSTORE_BASE64
   ```
2. **Secrets:** `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
   `GOOGLE_SERVICES_JSON_BASE64` (`base64 -w0 google-services.json` z Firebase).
3. **Variables:** `API_URL` (np. `https://api.example.com`),
   `GOOGLE_WEB_CLIENT_ID` (klient OAuth typu Web).
4. Pierwszy przebieg wypisze w podsumowaniu joba odciski SHA-1/SHA-256 klucza.
   **Dodaj SHA-1 w Firebase** (aplikacja Android) i w kliencie OAuth Android
   w Google Cloud, inaczej logowanie Google zwróci `DEVELOPER_ERROR`.
   Pobierz ponownie `google-services.json` po dodaniu i zaktualizuj secret.

## Po wydaniu

- W panelu admina backendu (Wersje aplikacji) ustaw `latest_version`
  na nowy numer i `download_url`. `min_version` podnoś tylko, gdy stare
  wersje mają przestać działać.

## Uwaga: prywatne repozytorium

Link `https://github.com/<repo>/releases/latest/download/moveyourass.apk`
działa bez logowania tylko w **publicznym** repo. W prywatnym pobranie
wymaga konta GitHub z dostępem do repo, a telefon bez przeglądarki z
zalogowanym GitHubem dostanie 404. Opcje: upublicznić repo (w repo nie ma
sekretów, zostają w GitHub Secrets) albo wystawiać APK z własnego serwera
(np. plik za Caddy).

## Architektura i czas budowania

APK jest budowany tylko dla `arm64-v8a` (wszystkie telefony z ostatnich
~8 lat). Pierwszy, zimny build potrafi trwać kilkadziesiąt minut (lokalnie
sprawdzony: udany, podpisany APK ~31 MB), kolejne korzystają z cache Gradle.
