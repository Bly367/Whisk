/**
 * Jest mock for expo-video-audio-extractor
 * Simulates audio extraction without native module.
 */

export interface ExtractAudioOptions {
  video: string;
  output: string;
  format?: 'wav' | 'm4a';
  channels?: 1 | 2;
  sampleRate?: number;
  start?: number;
  duration?: number;
  volume?: number;
}

export async function extractAudio(options: ExtractAudioOptions): Promise<void> {
  // Mock: simulate successful extraction by doing nothing
  // In real app, this would extract audio from video to output path
  return Promise.resolve();
}
