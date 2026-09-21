import { draftFromPastedText } from '@/import/parse/pasteText';
import type { ImportAdapter, ImportAdapterInput, ImportAdapterResult } from '@/import/types';

export const OCR_ADAPTER_ID = 'ocr-photo';

/**
 * Lazy-load the native OCR module to prevent Expo Go crashes.
 * Returns null if the module is unavailable (e.g., in Expo Go without a dev client rebuild).
 */
async function loadOcrModule(): Promise<{
  recognizeText: (uri: string) => Promise<{ text: string }>;
  isSupported: () => boolean;
} | null> {
  try {
    // In test environment, use synchronous require to work with Jest mocks
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
       
      const ExpoMlkitOcr = require('expo-mlkit-ocr');
      if (
        !ExpoMlkitOcr ||
        typeof ExpoMlkitOcr.recognizeText !== 'function' ||
        typeof ExpoMlkitOcr.isSupported !== 'function'
      ) {
        return null;
      }
      return ExpoMlkitOcr;
    }

    // Dynamic import prevents top-level static import that crashes Expo Go
     
    const ExpoMlkitOcr = await import('expo-mlkit-ocr');
    if (
      !ExpoMlkitOcr ||
      typeof ExpoMlkitOcr.recognizeText !== 'function' ||
      typeof ExpoMlkitOcr.isSupported !== 'function'
    ) {
      return null;
    }
    return ExpoMlkitOcr;
  } catch {
    // Module not available (Expo Go or missing native rebuild)
    return null;
  }
}

/**
 * OCR / photo import with lazy-loaded native module.
 * Gracefully handles missing native modules (Expo Go) with clear error messages.
 * Never invents recipe fields from an image URI alone.
 */
export const ocrAdapter: ImportAdapter = {
  id: OCR_ADAPTER_ID,
  kind: 'ocr',
  label: 'Photo / OCR',

  canHandle(input: ImportAdapterInput): boolean {
    return Boolean(input.imageUri?.trim());
  },

  async import(input: ImportAdapterInput): Promise<ImportAdapterResult> {
    if (!input.imageUri?.trim()) {
      return {
        ok: false,
        error: {
          code: 'needs_input',
          message: 'Choose a photo or screenshot to scan recipe text.',
          fallbacks: ['try_again', 'paste_text', 'manual'],
        },
      };
    }

    // Attempt to load the native OCR module
    const ocrModule = await loadOcrModule();

    if (!ocrModule) {
      // Native module unavailable (Expo Go or missing dev client rebuild)
      return {
        ok: false,
        error: {
          code: 'native_unavailable',
          message:
            'OCR is not available on this device. This usually means the app needs to be rebuilt with OCR support. Try pasting text manually or using a website link instead.',
          fallbacks: ['paste_text', 'manual'],
        },
      };
    }

    if (!ocrModule.isSupported()) {
      return {
        ok: false,
        error: {
          code: 'unsupported',
          message:
            'OCR is not supported on this device. Paste the recipe text manually or use a website link.',
          fallbacks: ['paste_text', 'manual'],
        },
      };
    }

    try {
      const result = await ocrModule.recognizeText(input.imageUri);

      if (!result?.text?.trim()) {
        return {
          ok: false,
          error: {
            code: 'parse_failed',
            message:
              'No text found in this image. Make sure the recipe is clearly visible and try again, or paste the text manually.',
            fallbacks: ['try_again', 'paste_text', 'manual'],
          },
        };
      }

      const draft = draftFromPastedText({
        text: result.text,
        titleHint: null,
        sourceUrl: null,
        adapterId: OCR_ADAPTER_ID,
      });

      if (!draft) {
        return {
          ok: false,
          error: {
            code: 'parse_failed',
            message:
              'Could not extract a recipe from this image. Check the photo quality and try again, or paste the text manually.',
            fallbacks: ['try_again', 'paste_text', 'manual'],
          },
        };
      }

      return {
        ok: true,
        draft: {
          ...draft,
          sourceKind: 'ocr',
          imageUri: input.imageUri,
          confidence: {
            ...draft.confidence,
            title: 'low',
            ingredients: 'low',
            instructions: 'low',
          },
          warnings: [
            {
              code: 'low_confidence',
              message:
                'This draft came from OCR. Double-check all quantities, ingredients, and steps before saving.',
            },
            ...draft.warnings.filter((w) => w.code !== 'low_confidence'),
          ],
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'parse_failed',
          message:
            error instanceof Error
              ? `OCR failed: ${error.message}`
              : 'Could not read text from this image. Try a clearer photo or paste the text manually.',
          fallbacks: ['try_again', 'paste_text', 'manual'],
        },
      };
    }
  },
};

export async function ocrStubWithoutImage(): Promise<ImportAdapterResult> {
  return ocrAdapter.import({});
}
