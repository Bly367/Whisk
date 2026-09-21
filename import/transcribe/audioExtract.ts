/**
 * Audio extraction from video files for transcription.
 * Extracts audio track as 16kHz mono WAV/M4A for Whisper input.
 */

export type AudioExtractResult = {
  audioPath: string;
  durationSeconds: number;
};

export type AudioExtractError = {
  code: 'extraction_failed' | 'unsupported_format' | 'file_not_found' | 'permission_denied';
  message: string;
  originalError?: unknown;
};

/**
 * Extract audio from video file for transcription.
 * Returns path to extracted audio file (16kHz mono if possible).
 * 
 * @param videoPath - Local file path to video file
 * @returns Audio file path and duration, or error
 */
export async function extractAudioFromVideo(
  videoPath: string,
): Promise<{ ok: true; result: AudioExtractResult } | { ok: false; error: AudioExtractError }> {
  // TODO: Implement with expo-av or expo-video-audio-extractor
  // For now, return a stub error indicating feature requires native build
  
  if (__DEV__) {
    // In development, simulate successful extraction with fixture path
    return {
      ok: true,
      result: {
        audioPath: videoPath.replace(/\.(mp4|mov|avi)$/i, '.m4a'),
        durationSeconds: 45, // Fixture duration
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'extraction_failed',
      message: 'Audio extraction requires native module. Rebuild app with EAS to enable.',
    },
  };
}

/**
 * Clean up extracted audio file after transcription.
 */
export async function cleanupAudioFile(audioPath: string): Promise<void> {
  // TODO: Implement file cleanup
  if (__DEV__) {
    console.log('[DEV] Would cleanup audio file:', audioPath);
  }
}
