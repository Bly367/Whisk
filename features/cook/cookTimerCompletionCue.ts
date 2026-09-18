/**
 * P2-W8 — side-effect ports for timer completion (audible + optional haptic).
 * Pure decision logic lives in cookTimers (`shouldSignalAudio`); this module fires cues.
 */
import { Vibration } from 'react-native';

export type CookTimerCompletionCuePorts = {
  playAudible: () => void | Promise<void>;
  playHaptic?: () => void | Promise<void>;
};

/**
 * Plays completion feedback once per batch of newly completed timer ids.
 * Callers must pass only rising-edge ids (see collectTimersNeedingAudibleCue).
 */
export async function fireCookTimerCompletionCues(
  newlyCompletedIds: readonly string[],
  ports: CookTimerCompletionCuePorts,
): Promise<void> {
  if (newlyCompletedIds.length === 0) return;
  await Promise.resolve(ports.playAudible());
  if (ports.playHaptic) {
    await Promise.resolve(ports.playHaptic());
  }
}

type LoadedSound = {
  replayAsync: () => Promise<unknown>;
  unloadAsync: () => Promise<unknown>;
};

let soundModule: LoadedSound | null = null;

/** Default audible: short bundled ding via expo-av (fails soft on unsupported platforms). */
export async function playDefaultCookTimerAudible(): Promise<void> {
  try {
    // Lazy import keeps Jest unit tests free of ExponentAV native module.
    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    if (soundModule) {
      await soundModule.replayAsync();
      return;
    }

    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/cook-timer-done.wav'),
      { shouldPlay: true, volume: 1 },
    );
    soundModule = sound;
  } catch {
    // Web / test / missing native module: visual + live region still apply.
  }
}

/** Default haptic: short vibration pattern (no-op where Vibration is unavailable). */
export function playDefaultCookTimerHaptic(): void {
  try {
    Vibration.vibrate([0, 220, 100, 220]);
  } catch {
    // Ignore unsupported environments.
  }
}

export function createDefaultCookTimerCompletionCuePorts(): CookTimerCompletionCuePorts {
  return {
    playAudible: playDefaultCookTimerAudible,
    playHaptic: playDefaultCookTimerHaptic,
  };
}

/** Test helper — drop cached sound between suites. */
export function resetCookTimerCompletionSoundForTests(): void {
  const previous = soundModule;
  soundModule = null;
  if (previous) {
    void previous.unloadAsync().catch(() => undefined);
  }
}
