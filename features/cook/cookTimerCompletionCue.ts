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

type AudioPlayer = {
  play: () => void;
  seekTo: (seconds: number) => void;
  release: () => void;
};

let audioPlayer: AudioPlayer | null = null;

/** Default audible: short bundled ding via expo-audio (fails soft on unsupported platforms). */
export async function playDefaultCookTimerAudible(): Promise<void> {
  try {
    // Lazy import keeps Jest unit tests free of native audio module.
    const { setAudioModeAsync, createAudioPlayer } = await import('expo-audio');
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
    });

    if (audioPlayer) {
      audioPlayer.seekTo(0);
      audioPlayer.play();
      return;
    }

    const player = createAudioPlayer(
      require('../../assets/sounds/cook-timer-done.wav'),
    );
    player.play();
    audioPlayer = player;
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
  const previous = audioPlayer;
  audioPlayer = null;
  if (previous) {
    try {
      previous.release();
    } catch {
      // Ignore release errors in test cleanup
    }
  }
}
