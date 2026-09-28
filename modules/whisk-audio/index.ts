import { requireOptionalNativeModule } from 'expo-modules-core';

export type PcmWavResult = {
  uri: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bytes: number;
};

type WhiskAudioNativeModule = {
  extractPcmWav(inputUri: string, outputUri: string): Promise<PcmWavResult>;
};

export async function extractPcmWav(inputUri: string, outputUri: string): Promise<PcmWavResult> {
  const nativeModule = requireOptionalNativeModule<WhiskAudioNativeModule>('WhiskAudio');
  if (!nativeModule) {
    throw new Error('Native module not linked: WhiskAudio');
  }

  return nativeModule.extractPcmWav(inputUri, outputUri);
}
