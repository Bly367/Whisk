/**
 * Type declarations for whisper.rn
 * Official types are not published yet, so we define minimal types here.
 */
declare module 'whisper.rn' {
  export interface WhisperContext {
    id: number;
    transcribe: (
      audioPath: string,
      options?: { language?: string; maxLen?: number; translate?: boolean },
    ) => {
      promise: Promise<{ result: string }>;
      stop: () => void;
    };
    release: () => Promise<void>;
  }

  export interface WhisperInitOptions {
    filePath: string;
    coreMLModelAsset?: {
      filename: string;
      assets: number[];
    };
  }

  export function initWhisper(options: WhisperInitOptions): Promise<WhisperContext>;

  export const libVersion: string;
}
