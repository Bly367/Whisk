import { ocrAdapter } from '@/import/adapters/ocrAdapter';
import { shareSheetAdapter } from '@/import/adapters/shareSheetAdapter';
import { websiteAdapter } from '@/import/adapters/websiteAdapter';
import type {
  ImportAdapter,
  ImportAdapterInput,
  ImportAdapterResult,
} from '@/import/types';

const defaultAdapters: ImportAdapter[] = [
  websiteAdapter,
  shareSheetAdapter,
  ocrAdapter,
];

let adapters: ImportAdapter[] = [...defaultAdapters];

/** Replace the adapter list (tests / future remote parsers). */
export function setImportAdapters(next: ImportAdapter[]): void {
  adapters = next;
}

export function resetImportAdapters(): void {
  adapters = [...defaultAdapters];
}

export function listImportAdapters(): ImportAdapter[] {
  return [...adapters];
}

export function getImportAdapter(id: string): ImportAdapter | undefined {
  return adapters.find((adapter) => adapter.id === id);
}

/**
 * Pick the first adapter that can handle the input.
 * Prefer an explicit adapterId when the Add tab already chose a path.
 */
export async function runImport(
  input: ImportAdapterInput,
  adapterId?: string,
): Promise<ImportAdapterResult> {
  if (adapterId) {
    const adapter = getImportAdapter(adapterId);
    if (!adapter) {
      return {
        ok: false,
        error: {
          code: 'unsupported',
          message: 'That import source is not available.',
          fallbacks: ['paste_text', 'scan', 'manual', 'try_again'],
        },
      };
    }
    return adapter.import(input);
  }

  const match = adapters.find((adapter) => adapter.canHandle(input));
  if (!match) {
    return {
      ok: false,
      error: {
        code: 'unsupported',
        message:
          'Whisk does not recognize that source yet. Paste text, scan a photo, or create manually.',
        fallbacks: ['paste_text', 'scan', 'manual', 'try_again'],
      },
    };
  }
  return match.import(input);
}
