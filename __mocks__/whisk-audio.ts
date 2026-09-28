export type PcmWavResult = {
  uri: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bytes: number;
};

type MockBehavior =
  | { kind: 'success'; durationSeconds?: number; uri?: string }
  | { kind: 'error'; code?: string; message: string };

let behavior: MockBehavior = { kind: 'success', durationSeconds: 12.5 };

export function configureWhiskAudioMock(nextBehavior: MockBehavior): void {
  behavior = nextBehavior;
}

export async function extractPcmWav(
  _inputUri: string,
  outputUri: string,
): Promise<PcmWavResult> {
  if (behavior.kind === 'error') {
    const error = new Error(behavior.message) as Error & { code?: string };
    error.code = behavior.code;
    throw error;
  }

  return {
    uri: behavior.uri ?? outputUri,
    durationSeconds: behavior.durationSeconds ?? 12.5,
    sampleRate: 16000,
    channels: 1,
    bytes: 400000,
  };
}
