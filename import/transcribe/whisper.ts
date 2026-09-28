/**
 * On-device speech-to-text using Whisper.
 * Uses tiny.en or base.en model for fast, offline transcription.
 */

import { initWhisper } from 'whisper.rn';
import type { WhisperContext } from 'whisper.rn';
import * as FileSystem from 'expo-file-system/legacy';

export type WhisperTranscriptResult = {
  text: string;
  segments?: {
    start: number;
    end: number;
    text: string;
  }[];
  language?: string;
  durationMs: number;
};

export type WhisperError = {
  code:
    | 'model_not_downloaded'
    | 'transcription_failed'
    | 'audio_load_failed'
    | 'unsupported_format'
    | 'out_of_memory';
  message: string;
  originalError?: unknown;
};

// Model hosting URLs (HuggingFace whisper.cpp GGML models)
const MODEL_HOST = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const MODEL_FILES = {
  tiny: 'ggml-tiny.en.bin',
  base: 'ggml-base.en.bin',
} as const;

// Cached Whisper context (singleton per model size)
let cachedContext: WhisperContext | null = null;
let cachedModelSize: 'tiny' | 'base' | null = null;

/**
 * Get model file path in document directory.
 */
function getModelPath(modelSize: 'tiny' | 'base'): string {
  return `${FileSystem.documentDirectory}${MODEL_FILES[modelSize]}`;
}

/**
 * Ensure Whisper model is downloaded and ready to use.
 * Downloads on first call; subsequent calls return immediately if cached.
 */
async function ensureModelDownloaded(
  modelSize: 'tiny' | 'base',
  onProgress?: (progress: number) => void,
): Promise<string> {
  const modelPath = getModelPath(modelSize);
  const modelUrl = `${MODEL_HOST}/${MODEL_FILES[modelSize]}`;

  // Check if model already exists
  const fileInfo = await FileSystem.getInfoAsync(modelPath);
  if (fileInfo.exists) {
    onProgress?.(1.0);
    return modelPath;
  }

  // Download model with progress tracking
  const downloadResumable = FileSystem.createDownloadResumable(
    modelUrl,
    modelPath,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      onProgress?.(progress);
    },
  );

  const result = await downloadResumable.downloadAsync();
  if (!result) {
    throw new Error('Model download failed');
  }

  return result.uri;
}

/**
 * Get or create Whisper context.
 * Reuses cached context if same model size.
 */
async function getWhisperContext(
  modelSize: 'tiny' | 'base',
  onProgress?: (progress: number) => void,
  onModelProgress?: (progress: number) => void,
): Promise<WhisperContext> {
  // Return cached context if same model
  if (cachedContext && cachedModelSize === modelSize) {
    return cachedContext;
  }

  // Release old context if switching models
  if (cachedContext) {
    await cachedContext.release();
    cachedContext = null;
    cachedModelSize = null;
  }

  // Download model if needed
  const modelPath = await ensureModelDownloaded(modelSize, onModelProgress ?? onProgress);

  // Initialize Whisper context
  const context = await initWhisper({
    filePath: modelPath,
  });

  // Cache for reuse
  cachedContext = context;
  cachedModelSize = modelSize;

  return context;
}

/**
 * Transcribe audio file using on-device Whisper model.
 * Downloads model on first use (lazy initialization with progress callback).
 *
 * @param audioPath - Local file path to audio file (16kHz mono WAV)
 * @param options - Transcription options
 * @returns Transcript text and metadata, or error
 */
export async function transcribeAudio(
  audioPath: string,
  options?: {
    language?: 'en' | 'auto';
    modelSize?: 'tiny' | 'base';
    onProgress?: (stage: 'downloading_model' | 'transcribing', progress: number) => void;
  },
): Promise<{ ok: true; result: WhisperTranscriptResult } | { ok: false; error: WhisperError }> {
  const modelSize = options?.modelSize || 'tiny';
  const startTime = Date.now();

  try {
    // Get or initialize Whisper context (may download model on first use)
    const context = await getWhisperContext(modelSize, undefined, (downloadProgress) => {
      options?.onProgress?.('downloading_model', downloadProgress);
    });

    // Transcribe audio
    options?.onProgress?.('transcribing', 0);
    const { promise } = context.transcribe(audioPath, {
      language: options?.language === 'auto' ? undefined : 'en',
      onProgress: (progress: number) => options?.onProgress?.('transcribing', progress / 100),
    } as never);

    const transcription = (await promise) as {
      result: string;
      segments?: { t0: number; t1: number; text: string }[];
    };

    // Map transcription completion to 50-100% progress
    options?.onProgress?.('transcribing', 1.0);

    const durationMs = Date.now() - startTime;

    return {
      ok: true,
      result: {
        text: transcription.result,
        segments: transcription.segments?.map((segment) => ({
          start: segment.t0 / 100,
          end: segment.t1 / 100,
          text: segment.text,
        })),
        language: 'en',
        durationMs,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Native module not linked')) {
      return {
        ok: false,
        error: {
          code: 'model_not_downloaded',
          message: 'Whisper transcription requires native module. Rebuild app with EAS to enable.',
          originalError: error,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'transcription_failed',
        message: error instanceof Error ? error.message : 'Transcription failed',
        originalError: error,
      },
    };
  }
}

/**
 * Check if Whisper model is downloaded and ready to use.
 * Returns download progress (0-1) or null if not started.
 */
export async function checkWhisperModelStatus(
  modelSize: 'tiny' | 'base' = 'tiny',
): Promise<{ ready: boolean; progress: number | null }> {
  try {
    const modelPath = getModelPath(modelSize);
    const fileInfo = await FileSystem.getInfoAsync(modelPath);

    if (fileInfo.exists) {
      return { ready: true, progress: 1.0 };
    }

    return { ready: false, progress: null };
  } catch {
    return { ready: false, progress: null };
  }
}

/**
 * Download Whisper model for offline use.
 * Only needs to be called once; model persists in app documents.
 */
export async function downloadWhisperModel(
  modelSize: 'tiny' | 'base' = 'tiny',
  onProgress?: (progress: number) => void,
): Promise<{ ok: true } | { ok: false; error: WhisperError }> {
  try {
    await ensureModelDownloaded(modelSize, onProgress);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'model_not_downloaded',
        message: error instanceof Error ? error.message : 'Model download failed',
        originalError: error,
      },
    };
  }
}
