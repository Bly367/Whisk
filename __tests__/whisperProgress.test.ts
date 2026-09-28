import { transcribeAudio } from '@/import/transcribe/whisper';

it('emits zero before transcription and forwards 50 percent as 0.5', async () => {
  const progress: [string, number][] = [];
  const result = await transcribeAudio('/tmp/audio.wav', {
    onProgress: (stage, value) => progress.push([stage, value]),
  });
  expect(result.ok).toBe(true);
  const zero = progress.findIndex(([stage, value]) => stage === 'transcribing' && value === 0);
  const half = progress.findIndex(([stage, value]) => stage === 'transcribing' && value === 0.5);
  expect(zero).toBeGreaterThanOrEqual(0);
  expect(half).toBeGreaterThan(zero);
});
