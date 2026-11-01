# MoveYourAss: aplikacja mobilna (Android)

Expo SDK 58 + TypeScript + expo-router. Backend: `../backend`.

```bash
cd mobile
npm install
cp .env.example .env     # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
npm run typecheck && npm test
```

Aplikacja używa natywnych modułów (logowanie Google, push FCM), więc **nie
działa w Expo Go**: potrzebny development build (`npx expo prebuild
--platform android` + `npx expo run:android`). Do tego trzeba mieć
`google-services.json` z Firebase (w `.gitignore`) oraz klienta OAuth Web
w Google Cloud (jego id to `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, ten sam co
`GOOGLE_CLIENT_IDS` w backendzie). Do podpisanego klucza dodaj SHA-1 w
konsoli Firebase.
