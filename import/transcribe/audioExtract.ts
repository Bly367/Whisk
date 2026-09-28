/**
 * Audio extraction from video files for transcription.
 * Extracts audio track as 16kHz mono WAV for Whisper input.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { extractPcmWav } from '@/modules/whisk-audio';

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
 * Returns path to extracted audio file (16kHz mono WAV for optimal Whisper performance).
 *
 * @param videoPath - Local file path to video file
 * @returns Audio file path and duration, or error
 */
export async function extractAudioFromVideo(
  videoPath: string,
): Promise<{ ok: true; result: AudioExtractResult } | { ok: false; error: AudioExtractError }> {
  try {
    // Generate output path in cache directory
    const timestamp = Date.now();
    const outputPath = `${FileSystem.cacheDirectory}whisper-audio-${timestamp}.wav`;

    const nativeResult = await extractPcmWav(videoPath, outputPath);
    const audioPath = stripFileScheme(nativeResult.uri);

    return {
      ok: true,
      result: {
        audioPath,
        durationSeconds: nativeResult.durationSeconds,
      },
    };
  } catch (error) {
    const nativeError = error as { code?: unknown; message?: unknown };
    const code = typeof nativeError.code === 'string' ? nativeError.code : undefined;
    const nativeMessage =
      typeof nativeError.message === 'string' ? nativeError.message : 'Audio extraction failed';

    if (nativeMessage.includes('Native module not linked')) {
      return {
        ok: false,
        error: {
          code: 'extraction_failed',
          message: 'Audio extraction requires an iOS EAS development build to enable.',
          originalError: error,
        },
      };
    }

    if (code === 'ERR_NO_AUDIO_TRACK') {
      return {
        ok: false,
        error: {
          code: 'unsupported_format',
          message: 'This video has no audio to transcribe.',
          originalError: error,
        },
      };
    }

    if (code === 'ERR_FILE_NOT_FOUND') {
      return {
        ok: false,
        error: {
          code: 'file_not_found',
          message: "Couldn't find the shared video. Try sharing it again.",
          originalError: error,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'extraction_failed',
        message: "Couldn't read this video's audio.",
        originalError: error,
      },
    };
  }
}

function stripFileScheme(path: string): string {
  return path.startsWith('file://') ? path.slice('file://'.length) : path;
}

/**
 * Clean up extracted audio file after transcription.
 */
export async function cleanupAudioFile(audioPath: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(audioPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(audioPath, { idempotent: true });
    }
  } catch (error) {
    // Non-fatal: log but don't throw
    console.warn('[audioExtract] Failed to cleanup audio file:', audioPath, error);
  }
}
