import { draftFromPastedText } from '@/import/parse/pasteText';
import type { ImportAdapter, ImportAdapterInput, ImportAdapterResult } from '@/import/types';

export const OCR_ADAPTER_ID = 'ocr-photo';

/**
 * OCR / photo import stub.
 * Entry point + fallbacks ship now; real OCR lands when the vision pipeline is ready.
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
          code: 'stub',
          message:
            'Photo and screenshot OCR is coming next. For now, paste recipe text, use a website link, or create the recipe manually.',
          fallbacks: ['paste_text', 'manual', 'try_again'],
        },
      };
    }

    // Image provided with manual text paste — create draft with photo as reference
    if (input.text?.trim()) {
      const draft = draftFromPastedText({
        text: input.text,
        adapterId: OCR_ADAPTER_ID,
      });
      if (draft) {
        return {
          ok: true,
          draft: {
            ...draft,
            sourceKind: 'ocr',
            imageUri: input.imageUri,
            warnings: [
              {
                code: 'manual_transcription',
                message:
                  'Recipe text was typed manually from the photo. OCR will extract text automatically when it ships.',
              },
              ...draft.warnings,
            ],
          },
        };
      }
    }

    // Image provided but no text and OCR not implemented — refuse silent/wrong extraction.
    return {
      ok: false,
      error: {
        code: 'stub',
        message:
          'Whisk saved a reference to your photo but cannot read it yet. Paste the text you see in the photo below to create a draft, or use manual entry so nothing incorrect is stored.',
        fallbacks: ['paste_text', 'manual', 'try_again'],
      },
    };
  },
};

export async function ocrStubWithoutImage(): Promise<ImportAdapterResult> {
  return ocrAdapter.import({});
}
