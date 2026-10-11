/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'widget',
  name: 'Lovas Widget',
  displayName: 'Lovas Board',
  // .containerBackground(for:) and .contentMarginsDisabled() require iOS 17.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  // Mirror the app group shared with the main app so the widget can read the
  // board snapshot / user config written by the JS side via ExtensionStorage.
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [],
  },
});
