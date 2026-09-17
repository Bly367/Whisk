import {
  draftFromExtracted,
  extractPageMetadata,
  extractRecipeJsonLd,
} from '@/import/parse/jsonLd';
import { draftFromPastedText } from '@/import/parse/pasteText';
import {
  canonicalizeUrl,
  detectSource,
  isSocialSource,
} from '@/import/parse/url';
import type {
  ImportAdapter,
  ImportAdapterInput,
  ImportAdapterResult,
} from '@/import/types';
import { DEFAULT_FALLBACKS } from '@/import/types';

export const WEBSITE_ADAPTER_ID = 'website-jsonld';

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (
    !contentType.includes('text/html') &&
    !contentType.includes('application/xhtml+xml') &&
    contentType.length > 0
  ) {
    throw Object.assign(new Error('not-html'), { code: 'unsupported' as const });
  }
  return response.text();
}

/**
 * Website importer: fetch HTML and extract schema.org Recipe JSON-LD.
 * Social hosts are rejected here so the share-sheet adapter owns that path.
 */
export function createWebsiteAdapter(
  fetchHtmlImpl: (url: string) => Promise<string> = fetchHtml,
): ImportAdapter {
  return {
    id: WEBSITE_ADAPTER_ID,
    kind: 'website',
    label: 'Website URL',

    canHandle(input: ImportAdapterInput): boolean {
      const raw = input.url ?? input.text ?? '';
      if (!raw.trim()) return false;
      try {
        const url = canonicalizeUrl(raw);
        return !isSocialSource(detectSource(url));
      } catch {
        return false;
      }
    },

    async import(input: ImportAdapterInput): Promise<ImportAdapterResult> {
      const raw = input.url ?? input.text ?? '';
      let url: string;
      try {
        url = canonicalizeUrl(raw);
      } catch {
        return {
          ok: false,
          error: {
            code: 'invalid_url',
            message: 'Paste a valid public recipe link.',
            fallbacks: DEFAULT_FALLBACKS,
          },
        };
      }

      const source = detectSource(url);
      if (isSocialSource(source)) {
        return {
          ok: false,
          error: {
            code: 'unsupported',
            message:
              'Social links need the share-sheet path or pasted caption text. Whisk will not invent a recipe from the URL alone.',
            fallbacks: ['paste_text', 'scan', 'manual', 'try_again'],
          },
        };
      }

      let html: string;
      try {
        html = await fetchHtmlImpl(url);
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code?: string }).code === 'unsupported'
        ) {
          return {
            ok: false,
            error: {
              code: 'unsupported',
              message: 'That link does not point to a webpage.',
              fallbacks: DEFAULT_FALLBACKS,
            },
          };
        }
        return {
          ok: false,
          error: {
            code: 'network',
            message:
              'Whisk could not reach that page. Try again, paste the recipe text, or create it manually.',
            fallbacks: DEFAULT_FALLBACKS,
          },
        };
      }

      const structured = extractRecipeJsonLd(html, url);
      if (structured) {
        return {
          ok: true,
          draft: draftFromExtracted(structured, {
            adapterId: WEBSITE_ADAPTER_ID,
            sourceKind: 'website',
            sourceUrl: url,
          }),
        };
      }

      const metadata = extractPageMetadata(html);
      if (input.text?.trim()) {
        const draft = draftFromPastedText({
          text: input.text.trim(),
          titleHint: metadata.title ?? null,
          sourceUrl: url,
          adapterId: WEBSITE_ADAPTER_ID,
        });
        if (draft) return { ok: true, draft };
        return {
          ok: false,
          error: {
            code: 'parse_failed',
            message: 'Could not find ingredients or steps in the pasted text.',
            fallbacks: DEFAULT_FALLBACKS,
          },
        };
      }

      return {
        ok: false,
        error: {
          code: 'needs_input',
          message: metadata.title
            ? `Found “${metadata.title}” but no structured recipe. Paste the ingredients and steps, scan a photo, or create manually.`
            : 'No structured recipe was found on that page. Paste the recipe text, scan a photo, or create manually.',
          fallbacks: ['paste_text', 'scan', 'manual', 'try_again'],
        },
      };
    },
  };
}

export const websiteAdapter = createWebsiteAdapter();
