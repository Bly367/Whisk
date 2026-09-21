/**
 * On-device speech-to-text using Whisper.
 * Uses tiny.en or base.en model for fast, offline transcription.
 */

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

/**
 * Transcribe audio file using on-device Whisper model.
 * Downloads model on first use (lazy initialization with progress callback).
 * 
 * @param audioPath - Local file path to audio file (WAV or M4A, 16kHz mono preferred)
 * @param options - Transcription options
 * @returns Transcript text and metadata, or error
 */
export async function transcribeAudio(
  audioPath: string,
  options?: {
    language?: 'en' | 'auto';
    modelSize?: 'tiny' | 'base';
    onProgress?: (progress: number) => void;
  },
): Promise<
  { ok: true; result: WhisperTranscriptResult } | { ok: false; error: WhisperError }
> {
  // TODO: Implement with whisper.rn native module
  // Model: tiny.en or base.en (offline, ~40MB download on first use)
  
  if (__DEV__) {
    // In development, return a fixture transcript for testing
    // This simulates a recipe video caption transcription
    const fixtureTranscript = `
    Hey everyone! Today I'm making my famous chocolate chip cookies.
    
    You'll need:
    - 2 cups all-purpose flour
    - 1 teaspoon baking soda
    - 1/2 teaspoon salt
    - 1 cup butter softened
    - 3/4 cup granulated sugar
    - 3/4 cup brown sugar
    - 2 eggs
    - 2 teaspoons vanilla extract
    - 2 cups chocolate chips
    
    First, preheat your oven to 375 degrees.
    Mix the flour, baking soda, and salt in a bowl.
    In another bowl, cream together the butter and both sugars until fluffy.
    Beat in the eggs one at a time, then add vanilla.
    Gradually stir in the flour mixture.
    Fold in the chocolate chips.
    Drop rounded tablespoons of dough onto baking sheets.
    Bake for 9 to 11 minutes until golden brown.
    Let them cool on the baking sheet for 2 minutes before transferring to a wire rack.
    Enjoy!
    `.trim();

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (options?.onProgress) {
      options.onProgress(1.0);
    }

    return {
      ok: true,
      result: {
        text: fixtureTranscript,
        language: 'en',
        durationMs: 500,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'model_not_downloaded',
      message: 'Whisper transcription requires native module. Rebuild app with EAS to enable.',
    },
  };
}

/**
 * Check if Whisper model is downloaded and ready to use.
 * Returns download progress (0-1) or null if not started.
 */
export async function checkWhisperModelStatus(
  modelSize: 'tiny' | 'base' = 'tiny',
): Promise<{ ready: boolean; progress: number | null }> {
  // TODO: Implement model status check with whisper.rn
  if (__DEV__) {
    return { ready: true, progress: 1.0 };
  }
  return { ready: false, progress: null };
}

/**
 * Download Whisper model for offline use.
 * Only needs to be called once; model persists in app documents.
 */
export async function downloadWhisperModel(
  modelSize: 'tiny' | 'base' = 'tiny',
  onProgress?: (progress: number) => void,
): Promise<{ ok: true } | { ok: false; error: WhisperError }> {
  // TODO: Implement model download with whisper.rn
  if (__DEV__) {
    // Simulate download progress
    for (let i = 0; i <= 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (onProgress) onProgress(i / 10);
    }
    return { ok: true };
  }
  
  return {
    ok: false,
    error: {
      code: 'model_not_downloaded',
      message: 'Whisper model download requires native module. Rebuild app with EAS to enable.',
    },
  };
}
