// app.json is the base; CI overrides version/versionCode from the git tag.
module.exports = ({ config }) => ({
  ...config,
  version: process.env.APP_VERSION || config.version,
  android: {
    ...config.android,
    versionCode:
      Number(process.env.APP_VERSION_CODE) || config.android.versionCode,
  },
  plugins: [...(config.plugins ?? []), './plugins/withReleaseSigning'],
});
