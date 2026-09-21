import { websiteAdapter } from '@/import/adapters/websiteAdapter';
import { draftFromPastedText } from '@/import/parse/pasteText';
import { canonicalizeUrl, detectSource, extractUrl, isSocialSource } from '@/import/parse/url';
import type { ImportAdapter, ImportAdapterInput, ImportAdapterResult } from '@/import/types';
import { DEFAULT_FALLBACKS } from '@/import/types';

export const SHARE_SHEET_ADAPTER_ID = 'share-sheet';

/**
 * Share-sheet entry stub.
 * - Website URLs delegate to the website adapter.
 * - Social URLs require pasted caption text (no invented recipes).
 * - Pure stub when OS share payload is not yet wired.
 */
export const shareSheetAdapter: ImportAdapter = {
  id: SHARE_SHEET_ADAPTER_ID,
  kind: 'share_sheet',
  label: 'Share sheet',

  canHandle(input: ImportAdapterInput): boolean {
    return Boolean(input.sharedContent?.trim() || input.url?.trim() || input.text?.trim());
  },

  async import(input: ImportAdapterInput): Promise<ImportAdapterResult> {
    const shared = input.sharedContent?.trim() || '';
    const urlFromShare = extractUrl(shared) ?? input.url?.trim() ?? null;
    const caption =
      input.text?.trim() ||
      (shared && !extractUrl(shared) ? shared : shared.replace(urlFromShare ?? '', '').trim()) ||
      undefined;

    if (!urlFromShare && !caption) {
      return {
        ok: false,
        error: {
          code: 'stub',
          message:
            'Share-sheet capture is wired as an entry point. Open this from another app’s Share menu, or paste a link and caption here.',
          fallbacks: DEFAULT_FALLBACKS,
        },
      };
    }

    if (urlFromShare) {
      let canonical: string;
      try {
        canonical = canonicalizeUrl(urlFromShare);
      } catch {
        return {
          ok: false,
          error: {
            code: 'invalid_url',
            message: 'That shared link does not look like a public URL.',
            fallbacks: DEFAULT_FALLBACKS,
          },
        };
      }

      const source = detectSource(canonical);
      if (!isSocialSource(source)) {
        return websiteAdapter.import({
          url: canonical,
          text: caption,
        });
      }

      if (caption) {
        const draft = draftFromPastedText({
          text: caption,
          sourceUrl: canonical,
          adapterId: SHARE_SHEET_ADAPTER_ID,
        });
        if (draft) {
          return {
            ok: true,
            draft: {
              ...draft,
              sourceKind: 'share_sheet',
              sourceName: source,
              confidence: {
                ...draft.confidence,
                title: 'medium',
                ingredients: draft.ingredients.length ? 'low' : 'unknown',
                instructions: draft.instructions.length ? 'low' : 'unknown',
              },
              warnings: [
                {
                  code: 'low_confidence',
                  message: `Imported from a ${source} share with pasted caption. Review carefully — social captions are often incomplete.`,
                },
                ...draft.warnings.filter((w) => w.code !== 'low_confidence'),
              ],
            },
          };
        }

        // Caption was provided but couldn't be parsed
        return {
          ok: false,
          error: {
            code: 'parse_failed',
            message: `Could not find ingredients or steps in the ${source} caption. Social captions need clear recipe details with ingredients and cooking steps. Try editing the caption to make the recipe clearer, or use manual entry.`,
            fallbacks: ['paste_text', 'manual', 'try_again'],
          },
        };
      }

      // No caption provided at all
      return {
        ok: false,
        error: {
          code: 'needs_input',
          message: `This ${source} link needs the post caption to create a recipe. Paste the full caption text below (with ingredients and steps). Whisk does not download or analyze video content — it needs the text you provide.`,
          fallbacks: ['paste_text', 'scan', 'manual', 'try_again'],
        },
      };
    }

    // Caption-only share without URL
    const draft = draftFromPastedText({
      text: caption!,
      adapterId: SHARE_SHEET_ADAPTER_ID,
    });
    if (draft) {
      return {
        ok: true,
        draft: { ...draft, sourceKind: 'share_sheet' },
      };
    }

    return {
      ok: false,
      error: {
        code: 'stub',
        message:
          'Share-sheet import is ready as an entry point. Provide a link and caption, or use paste / scan / manual fallbacks.',
        fallbacks: DEFAULT_FALLBACKS,
      },
    };
  },
};

/** Empty draft for the share-sheet UI stub when nothing was shared yet. */
export function emptyShareSheetPlaceholder(): ImportAdapterResult {
  return {
    ok: false,
    error: {
      code: 'stub',
      message:
        "Share recipes from Instagram Reels, TikTok, YouTube Shorts, or cooking websites into Whisk. For social posts, you'll need to paste the caption text — Whisk imports recipe text, not video content. Until device sharing is fully connected, paste the link and caption here.",
      fallbacks: DEFAULT_FALLBACKS,
    },
  };
}
