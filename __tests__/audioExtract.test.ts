import { extractAudioFromVideo } from '@/import/transcribe/audioExtract';
import { configureWhiskAudioMock, type PcmWavResult } from '../__mocks__/whisk-audio';
import { transcribeVideo } from '@/import/transcribe';
import { lastTranscribedAudioPath, resetWhisperMock } from '../__mocks__/whisper.rn';

jest.mock('expo-file-system/legacy', () => ({
  ...jest.requireActual('expo-file-system/legacy'),
  cacheDirectory: 'file:///cache/',
  documentDirectory: '/documents/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  deleteAsync: jest.fn(async () => undefined),
}));

const success = (overrides: Partial<PcmWavResult> = {}) =>
  configureWhiskAudioMock({
    kind: 'success',
    durationSeconds: 12.5,
    ...overrides,
  });

describe('extractAudioFromVideo', () => {
  beforeEach(() => success());

  it('uses native duration and writes to a cache-directory wav path', async () => {
    const result = await extractAudioFromVideo('/videos/recipe.mp4');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.durationSeconds).toBe(12.5);
    expect(result.result.audioPath).toMatch(/whisper-audio-\d+\.wav$/);
    expect(result.result.audioPath).toMatch(/cache/i);
  });

  it.each([
    ['ERR_NO_AUDIO_TRACK', 'unsupported_format', 'This video has no audio to transcribe.'],
    [
      'ERR_FILE_NOT_FOUND',
      'file_not_found',
      "Couldn't find the shared video. Try sharing it again.",
    ],
    ['ERR_DECODE_FAILED', 'extraction_failed', "Couldn't read this video's audio."],
  ] as const)(
    'maps %s to %s with a user-facing message',
    async (code, expectedCode, expectedMessage) => {
      configureWhiskAudioMock({ kind: 'error', code, message: `native ${code}` });

      const result = await extractAudioFromVideo('/videos/recipe.mp4');

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({ code: expectedCode, message: expectedMessage }),
        }),
      );
      if (!result.ok) {
        expect(result.error.originalError).toEqual(
          expect.objectContaining({ code, message: `native ${code}` }),
        );
      }
    },
  );

  it('maps a missing native module to the rebuild message', async () => {
    configureWhiskAudioMock({
      kind: 'error',
      message: 'Native module not linked: WhiskAudio',
    });

    const result = await extractAudioFromVideo('/videos/recipe.mp4');

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({
          code: 'extraction_failed',
          message: 'Audio extraction requires an iOS EAS development build to enable.',
        }),
      }),
    );
  });
});

describe('transcription handoff', () => {
  beforeEach(() => {
    success({ durationSeconds: 3 });
    resetWhisperMock();
  });

  it('reaches transcribeAudio with the native output path form', async () => {
    const result = await transcribeVideo('/videos/recipe.mp4');

    expect(result.ok).toBe(true);
    expect(lastTranscribedAudioPath).toMatch(/^\/cache\/whisper-audio-\d+\.wav$/);
  });
});

describe('whisk-audio JavaScript module fallback', () => {
  it('throws when the native module is not linked', async () => {
    jest.resetModules();
    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: () => null,
    }));

    /* eslint-disable @typescript-eslint/no-require-imports */
    const { extractPcmWav } =
      require('../modules/whisk-audio') as typeof import('../modules/whisk-audio');
    /* eslint-enable @typescript-eslint/no-require-imports */

    await expect(extractPcmWav('/input.mp4', '/output.wav')).rejects.toThrow(
      'Native module not linked',
    );
    jest.dontMock('expo-modules-core');
    jest.resetModules();
  });
});
