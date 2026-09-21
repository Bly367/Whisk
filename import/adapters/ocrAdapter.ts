import { recognizeText, isSupported } from 'expo-mlkit-ocr';

import { draftFromPastedText } from '@/import/parse/pasteText';
import type { ImportAdapter, ImportAdapterInput, ImportAdapterResult } from '@/import/types';

export const OCR_ADAPTER_ID = 'ocr-photo';

/**
 * OCR / photo import — thin path using expo-mlkit-ocr.
 * Recognizes text from images and feeds the existing paste-text parser.
 * Never invents recipe fields from an image URI alone.
 * Allows manual text paste alongside imageUri as a workaround until OCR ships.
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

    if (!isSupported()) {
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
      const result = await recognizeText(input.imageUri);

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
