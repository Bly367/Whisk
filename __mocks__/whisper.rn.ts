/**
 * Jest mock for whisper.rn
 * Returns fixture transcript for testing without native module.
 */

export interface WhisperContext {
  id: number;
  transcribe: (
    audioPath: string,
    options?: { language?: string },
  ) => {
    promise: Promise<{ result: string }>;
    stop: () => void;
  };
  release: () => Promise<void>;
}

let nextContextId = 1;

export async function initWhisper(_options: {
  filePath: string;
}): Promise<WhisperContext> {
  const contextId = nextContextId++;

  return {
    id: contextId,
    transcribe: (audioPath: string, _options?: { language?: string }) => {
      // Return fixture transcript for testing
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

      // Simulate async transcription with a small delay
      return {
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({ result: fixtureTranscript });
          }, 50);
        }),
        stop: () => {
          // no-op in mock
        },
      };
    },
    release: async () => {
      // no-op in mock
    },
  };
}

export const libVersion = '0.7.4';
