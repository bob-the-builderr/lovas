const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// `@/` resolves from the project root so `@/lib`, `@/components`, `@/types`
// all map to their top-level folders.
config.resolver.alias = {
  '@': __dirname,
};

module.exports = config;
