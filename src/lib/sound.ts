// Lightweight SFX manager. All five sound files are preloaded at app
// boot from /assets/audio so playback is zero-latency at the moment a
// game event fires. Each sound is owned by a single cached
// `Audio.Sound` instance — we just rewind + replay on each call rather
// than allocating new instances per fire (cheaper and avoids the
// "rapid taps don't all play" bug from concurrent loaders).
//
// All playback respects the player's SOUND toggle from settings;
// `playSfx` no-ops when sound is disabled or the manager hasn't
// finished loading yet.

import { Audio } from 'expo-av';
import { isSoundOn } from '../data/player';

export type SfxName = 'hit' | 'miss' | 'streak' | 'game-over' | 'pb';

// Static requires so Metro bundles the assets into the binary.
const SOUND_FILES: Record<SfxName, number> = {
  'hit': require('../../assets/audio/hit.ogg'),
  'miss': require('../../assets/audio/miss.ogg'),
  'streak': require('../../assets/audio/streak.ogg'),
  'game-over': require('../../assets/audio/game-over.ogg'),
  'pb': require('../../assets/audio/pb.ogg'),
};

const cache = new Map<SfxName, Audio.Sound>();
let loaded = false;
let loading: Promise<void> | null = null;

/** Preload every SFX. Idempotent — safe to call multiple times. */
export async function loadSounds(): Promise<void> {
  if (loaded) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      // Game audio behavior: plays even when phone is on silent (the
      // user-facing toggle in Settings is the source of truth, not the
      // hardware mute switch — same convention every iOS game uses).
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      for (const name of Object.keys(SOUND_FILES) as SfxName[]) {
        const { sound } = await Audio.Sound.createAsync(SOUND_FILES[name]);
        cache.set(name, sound);
      }
      loaded = true;
    } catch (err) {
      if (__DEV__) console.warn('[sound] load failed:', err);
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Fire a one-shot SFX. Silent no-op if sound is off or not loaded. */
export async function playSfx(name: SfxName): Promise<void> {
  if (!isSoundOn() || !loaded) return;
  const s = cache.get(name);
  if (!s) return;
  try {
    await s.setPositionAsync(0);
    await s.playAsync();
  } catch {
    /* expo-av occasionally rejects rapid replays; swallow. */
  }
}

/** Best-effort cleanup — unused right now but cheap insurance for the
 *  future if we ever want to free memory mid-session. */
export async function unloadSounds(): Promise<void> {
  for (const s of cache.values()) {
    try {
      await s.unloadAsync();
    } catch {
      /* swallow */
    }
  }
  cache.clear();
  loaded = false;
}
