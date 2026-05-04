// Metro bundler config — extends Expo's default to register `.ogg`
// as a bundled asset extension. The Kenney audio packs ship as .ogg
// and Metro's default assetExts list doesn't include it, so without
// this the require('../../assets/audio/hit.ogg') calls in src/lib/sound.ts
// fail to resolve.
//
// If you ever swap the audio kit out for .wav or .mp3 files (already
// in the default list), this config is harmless to keep around.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('ogg')) {
  config.resolver.assetExts.push('ogg');
}

module.exports = config;
