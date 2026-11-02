// Signs the release APK with our own keystore in CI.
//
// Reads ANDROID_KEYSTORE_FILE / _PASSWORD, ANDROID_KEY_ALIAS / _PASSWORD
// from the environment. Without them (local builds) release falls back to
// the debug key, so `gradlew assembleRelease` still works on a laptop.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `release {
            def ks = System.getenv('ANDROID_KEYSTORE_FILE')
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
        `;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('ANDROID_KEYSTORE_FILE')) return cfg; // idempotent

    const signingMarker = /signingConfigs \{\s*\n(\s*)debug \{/;
    if (!signingMarker.test(gradle) || !gradle.includes('buildTypes {')) {
      throw new Error(
        'withReleaseSigning: unexpected android/app/build.gradle layout',
      );
    }
    gradle = gradle.replace(signingMarker, (m) =>
      m.replace(/debug \{$/, RELEASE_SIGNING + 'debug {'),
    );

    const [head, tail] = [
      gradle.slice(0, gradle.indexOf('buildTypes {')),
      gradle.slice(gradle.indexOf('buildTypes {')),
    ];
    const patchedTail = tail.replace(
      /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('ANDROID_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    if (patchedTail === tail) {
      throw new Error('withReleaseSigning: release buildType not found');
    }
    cfg.modResults.contents = head + patchedTail;
    return cfg;
  });
};
