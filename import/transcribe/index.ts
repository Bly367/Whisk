/**
 * Video transcription pipeline for social media recipe imports.
 * Extracts audio from video, transcribes with Whisper, feeds into recipe parser.
 */

import { extractAudioFromVideo, cleanupAudioFile } from './audioExtract';
import { transcribeAudio, checkWhisperModelStatus, downloadWhisperModel } from './whisper';
import type { AudioExtractError } from './audioExtract';
import type { WhisperError, WhisperTranscriptResult } from './whisper';

export type { WhisperTranscriptResult, AudioExtractError, WhisperError };
export { checkWhisperModelStatus, downloadWhisperModel };

export type TranscribeVideoError = {
  code: 'audio_extraction_failed' | 'transcription_failed' | 'file_not_found';
  message: string;
  details?: AudioExtractError | WhisperError;
};

/**
 * Full pipeline: Video → Audio → Transcript.
 * Handles cleanup automatically.
 *
 * @param videoPath - Local file path to video file
 * @param options - Transcription options
 * @returns Transcript text ready for recipe parser
 */
export async function transcribeVideo(
  videoPath: string,
  options?: {
    language?: 'en' | 'auto';
    modelSize?: 'tiny' | 'base';
    onProgress?: (
      stage: 'downloading_model' | 'extracting' | 'transcribing',
      progress: number,
    ) => void;
  },
): Promise<
  | { ok: true; transcript: string; metadata: WhisperTranscriptResult }
  | { ok: false; error: TranscribeVideoError }
> {
  // Step 1: Extract audio from video
  options?.onProgress?.('extracting', 0);

  const audioResult = await extractAudioFromVideo(videoPath);
  if (!audioResult.ok) {
    return {
      ok: false,
      error: {
        code: 'audio_extraction_failed',
        message: audioResult.error.message,
        details: audioResult.error,
      },
    };
  }

  options?.onProgress?.('extracting', 1.0);

  const { audioPath } = audioResult.result;

  try {
    // Step 2: Transcribe audio with Whisper
    const transcriptResult = await transcribeAudio(audioPath, {
      language: options?.language,
      modelSize: options?.modelSize,
      onProgress: (stage, progress) => {
        if (options?.onProgress) {
          options.onProgress(stage, progress);
        }
      },
    });

    if (!transcriptResult.ok) {
      return {
        ok: false,
        error: {
          code: 'transcription_failed',
          message: transcriptResult.error.message,
          details: transcriptResult.error,
        },
      };
    }

    return {
      ok: true,
      transcript: transcriptResult.result.text,
      metadata: transcriptResult.result,
    };
  } finally {
    // Always cleanup extracted audio file
    await cleanupAudioFile(audioPath);
  }
}
