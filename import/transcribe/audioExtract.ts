/**
 * Audio extraction from video files for transcription.
 * Extracts audio track as 16kHz mono WAV/M4A for Whisper input.
 */

import { extractAudio } from 'expo-video-audio-extractor';
import * as FileSystem from 'expo-file-system/legacy';

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

    // Extract audio as 16kHz mono WAV (optimal for Whisper)
    await extractAudio({
      video: videoPath,
      output: outputPath,
      format: 'wav',
      channels: 1, // mono
      sampleRate: 16000, // 16kHz for Whisper
    });

    // Get file info to extract duration (rough estimate from file size)
    const fileInfo = await FileSystem.getInfoAsync(outputPath);
    if (!fileInfo.exists) {
      throw new Error('Extraction succeeded but output file not found');
    }

    // Rough duration estimate: 16-bit mono @ 16kHz = 32KB/sec
    const estimatedDuration = fileInfo.size / (16000 * 2);

    return {
      ok: true,
      result: {
        audioPath: outputPath,
        durationSeconds: estimatedDuration,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Native module not linked')) {
      return {
        ok: false,
        error: {
          code: 'extraction_failed',
          message: 'Audio extraction requires native module. Rebuild app with EAS to enable.',
          originalError: error,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'extraction_failed',
        message: error instanceof Error ? error.message : 'Audio extraction failed',
        originalError: error,
      },
    };
  }
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
