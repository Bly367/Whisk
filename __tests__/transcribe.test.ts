import { transcribeVideo } from '@/import/transcribe';
import { draftFromPastedText } from '@/import/parse/pasteText';

describe('transcribeVideo', () => {
  it('should transcribe video and return text', async () => {
    const result = await transcribeVideo('/path/to/video.mp4');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transcript).toBeTruthy();
      expect(typeof result.transcript).toBe('string');
      expect(result.metadata.durationMs).toBeGreaterThan(0);
    }
  });

  it('should report progress during transcription', async () => {
    const progressStages: { stage: string; progress: number }[] = [];
    
    await transcribeVideo('/path/to/video.mp4', {
      onProgress: (stage, progress) => {
        progressStages.push({ stage, progress });
      },
    });

    expect(progressStages.length).toBeGreaterThan(0);
    expect(progressStages.some((p) => p.stage === 'extracting')).toBe(true);
    expect(progressStages.some((p) => p.stage === 'transcribing')).toBe(true);
  });
});

describe('transcript to recipe parser handoff', () => {
  it('should parse recipe from video transcript fixture', async () => {
    // Get transcript from video transcription
    const transcribeResult = await transcribeVideo('/path/to/recipe-video.mp4');
    expect(transcribeResult.ok).toBe(true);
    
    if (!transcribeResult.ok) return;
    
    const { transcript } = transcribeResult;

    // Feed transcript into recipe parser (same path as pasted captions)
    const draft = draftFromPastedText({
      text: transcript,
      adapterId: 'test-transcribe',
      sourceName: 'Instagram',
      sourceUrl: 'https://www.instagram.com/p/ABC123/',
    });

    // Should successfully parse recipe from transcript
    expect(draft).not.toBeNull();
    expect(draft?.title).toBeTruthy();
    expect(draft?.ingredients.length).toBeGreaterThan(0);
    expect(draft?.instructions.length).toBeGreaterThan(0);
  });

  it('should parse ingredients from transcript', async () => {
    const transcribeResult = await transcribeVideo('/path/to/recipe-video.mp4');
    expect(transcribeResult.ok).toBe(true);
    
    if (!transcribeResult.ok) return;
    
    const draft = draftFromPastedText({
      text: transcribeResult.transcript,
      adapterId: 'test-transcribe',
    });

    expect(draft).not.toBeNull();
    expect(draft?.ingredients.length).toBeGreaterThan(0);
    
    // Check that ingredients have expected structure
    const firstIngredient = draft?.ingredients[0];
    expect(firstIngredient).toHaveProperty('name');
    expect(firstIngredient?.name).toBeTruthy();
  });

  it('should parse instructions from transcript', async () => {
    const transcribeResult = await transcribeVideo('/path/to/recipe-video.mp4');
    expect(transcribeResult.ok).toBe(true);
    
    if (!transcribeResult.ok) return;
    
    const draft = draftFromPastedText({
      text: transcribeResult.transcript,
      adapterId: 'test-transcribe',
    });

    expect(draft).not.toBeNull();
    expect(draft?.instructions.length).toBeGreaterThan(0);
    
    // Check that instructions have expected structure
    const firstStep = draft?.instructions[0];
    expect(firstStep).toHaveProperty('text');
    expect(firstStep?.text).toBeTruthy();
  });

  it('should handle transcript with social media fluff', async () => {
    // Simulate transcript with typical social media intro/outro
    const socialTranscript = `
      Hey everyone! Don't forget to like and subscribe!
      
      Today I'm making chocolate chip cookies.
      
      Ingredients:
      - 2 cups flour
      - 1 cup butter
      - 1 cup sugar
      - 2 eggs
      - 2 cups chocolate chips
      
      Instructions:
      1. Mix dry ingredients
      2. Cream butter and sugar
      3. Add eggs
      4. Combine everything
      5. Bake at 375 for 10 minutes
      
      Thanks for watching! Drop a comment if you try this!
    `;

    const draft = draftFromPastedText({
      text: socialTranscript,
      adapterId: 'test-transcribe',
      sourceName: 'TikTok',
    });

    expect(draft).not.toBeNull();
    expect(draft?.ingredients.length).toBeGreaterThan(0);
    expect(draft?.instructions.length).toBeGreaterThan(0);
    
    // Should extract recipe content despite social fluff
    expect(draft?.ingredients.some((ing) => ing.name.includes('flour'))).toBe(true);
    expect(draft?.instructions.some((step) => step.text.toLowerCase().includes('mix'))).toBe(true);
  });
});
