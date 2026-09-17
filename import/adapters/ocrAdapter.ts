import type {
  ImportAdapter,
  ImportAdapterInput,
  ImportAdapterResult,
} from '@/import/types';
import { DEFAULT_FALLBACKS } from '@/import/types';

export const OCR_ADAPTER_ID = 'ocr-photo';

/**
 * OCR / photo import stub.
 * Entry point + fallbacks ship now; real OCR lands when the vision pipeline is ready.
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
          code: 'stub',
          message:
            'Photo and screenshot OCR is coming next. For now, paste recipe text, use a website link, or create the recipe manually.',
          fallbacks: ['paste_text', 'manual', 'try_again'],
        },
      };
    }

    // Image provided but OCR not implemented — refuse silent/wrong extraction.
    return {
      ok: false,
      error: {
        code: 'stub',
        message:
          'Whisk saved a reference to your photo but cannot read it yet. Paste the text you see, or create the recipe manually so nothing incorrect is stored.',
        fallbacks: ['paste_text', 'manual', 'try_again'],
      },
    };
  },
};

export async function ocrStubWithoutImage(): Promise<ImportAdapterResult> {
  return ocrAdapter.import({});
}
