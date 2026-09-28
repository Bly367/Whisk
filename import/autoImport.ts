import { websiteAdapter } from '@/import/adapters/websiteAdapter';
import { commitAutoImportDraft } from '@/import/commit';
import { draftFromPastedText } from '@/import/parse/pasteText';
import { draftFromTranscript } from '@/import/parse/transcript';
import { detectSource } from '@/import/parse/url';
import { fetchSocialMeta, type SocialMeta } from '@/import/social/socialMeta';
import { videoFromUrl } from '@/import/social/videoFromUrl';
import { transcribeVideo } from '@/import/transcribe';
import { scoreDraft } from '@/import/score';
import type { ImportDraft } from '@/import/types';
import { useAutoImportStore } from '@/import/autoImportStore';

export type AutoImportPayload = {
  url?: string;
  sharedText?: string;
  videoPath?: string;
  sourceName?: string;
};
export type AutoStage =
  | 'receiving'
  | 'fetching_caption'
  | 'following_link'
  | 'downloading_video'
  | 'downloading_model'
  | 'extracting_audio'
  | 'transcribing'
  | 'saving'
  | 'saved'
  | 'failed';
export type AutoImportDeps = {
  fetchSocialMeta?: typeof fetchSocialMeta;
  videoFromUrl?: typeof videoFromUrl;
  transcribeVideo?: typeof transcribeVideo;
  websiteImport?: (url: string) => Promise<{ ok: true; draft: ImportDraft } | { ok: false }>;
  commitImportDraft?: (draft: ImportDraft) => { id: string };
};
export type AutoImportResult =
  | {
      ok: true;
      recipe: { id: string };
      draft: ImportDraft;
      lowConfidence: boolean;
      source: 'caption' | 'audio' | 'web' | 'caption+audio';
      hints?: string[];
    }
  | {
      ok: false;
      reason: string;
      actions: ['try_again', 'choose_video', 'manual'];
      hints?: string[];
    };

const failed = (hints?: string[]): AutoImportResult => ({
  ok: false,
  reason: "Couldn't find a recipe in this post",
  actions: ['try_again', 'choose_video', 'manual'],
  hints,
});

export async function runAutoImport(
  payload: AutoImportPayload,
  deps: AutoImportDeps = {},
  onStage: (stage: AutoStage, progress?: number) => void = () => {},
): Promise<AutoImportResult> {
  try {
    return await runAutoImportUnsafe(payload, deps, onStage);
  } catch {
    onStage('failed');
    return failed();
  }
}

async function runAutoImportUnsafe(
  payload: AutoImportPayload,
  deps: AutoImportDeps,
  onStage: (stage: AutoStage, progress?: number) => void,
): Promise<AutoImportResult> {
  onStage('receiving');
  const isLocal = Boolean(payload.videoPath);
  const candidates: {
    draft: ImportDraft;
    source: 'caption' | 'audio' | 'web' | 'caption+audio';
  }[] = [];
  const tried = new Set<string>();
  let meta: SocialMeta | null = null;
  let audioReason = 'no_video_url';

  if (!isLocal && payload.url && detectSource(payload.url) === 'website') {
    const website = await safeWebsiteImport(payload.url, deps);
    if (website?.ok) {
      if (scoreDraft(website.draft).passes)
        return save(website.draft, 'web', 'website', onStage, deps);
      candidates.push({ draft: website.draft, source: 'web' });
    }
  } else if (!isLocal && payload.url) {
    onStage('fetching_caption');
    try {
      meta = await (deps.fetchSocialMeta ?? fetchSocialMeta)(payload.url);
    } catch {
      meta = null;
    }
    if (meta) {
      const caption = [meta.caption, payload.sharedText].filter(Boolean).join('\n\n');
      const parsed = caption ? safePastedDraft(caption, meta) : null;
      const spoken = caption ? safeTranscriptDraft(caption, meta) : null;
      if (parsed) candidates.push({ draft: parsed, source: 'caption' });
      if (spoken && (!parsed || scoreDraft(spoken).score > scoreDraft(parsed).score))
        candidates.push({ draft: spoken, source: 'caption' });
      const passingCaption = candidates.find(
        (item) => item.source === 'caption' && scoreDraft(item.draft).passes,
      );
      if (passingCaption) return save(passingCaption.draft, 'caption', meta.source, onStage, deps);
      for (const link of meta.linkedUrls) {
        tried.add(link);
        const website = await safeWebsiteImport(link, deps, onStage);
        if (website?.ok) {
          candidates.push({ draft: website.draft, source: 'web' });
          if (scoreDraft(website.draft).passes)
            return save(website.draft, 'web', meta.source, onStage, deps);
        }
      }
    }
  }

  let cleanup: (() => Promise<void>) | undefined;
  let audioDraft: ImportDraft | null = null;
  if (payload.videoPath || meta?.videoUrl) {
    let videoPath = payload.videoPath;
    if (!videoPath && meta) {
      onStage('downloading_video');
      try {
        const downloaded = await (deps.videoFromUrl ?? videoFromUrl)(meta);
        if (downloaded.ok) {
          videoPath = downloaded.uri;
          cleanup = downloaded.cleanup;
        } else audioReason = downloaded.reason;
      } catch {
        audioReason = 'network';
      }
    }
    if (videoPath) {
      try {
        const result = await (deps.transcribeVideo ?? transcribeVideo)(videoPath, {
          onProgress: (stage, progress) =>
            onStage(
              stage === 'downloading_model'
                ? 'downloading_model'
                : stage === 'extracting'
                  ? 'extracting_audio'
                  : 'transcribing',
              progress,
            ),
        });
        if (result.ok)
          audioDraft = safeTranscriptDraft(result.transcript, meta, result.metadata.segments);
      } catch {
        audioReason = 'transcription_failed';
      }
    }
  }
  if (audioDraft) {
    const cap = candidates.find((item) => item.source === 'caption');
    if (
      cap &&
      scoreDraft(cap.draft).ingredients >= 3 &&
      scoreDraft(cap.draft).steps < 2 &&
      scoreDraft(audioDraft).steps >= 2
    ) {
      if (cleanup) await cleanup();
      return save(
        { ...cap.draft, instructions: audioDraft.instructions, adapterId: 'share-auto-merge' },
        'caption+audio',
        meta?.source ?? payload.sourceName ?? 'Photos',
        onStage,
        deps,
        false,
        hintsFor(meta, audioReason),
      );
    }
    if (scoreDraft(audioDraft).passes) {
      if (cleanup) await cleanup();
      return save(
        audioDraft,
        'audio',
        meta?.source ?? payload.sourceName ?? 'Photos',
        onStage,
        deps,
        false,
        hintsFor(meta, audioReason),
      );
    }
    candidates.push({ draft: audioDraft, source: 'audio' });
  }
  if (cleanup) await cleanup();

  if (meta) {
    for (const link of meta.linkedUrls) {
      if (tried.has(link)) continue;
      tried.add(link);
      const website = await safeWebsiteImport(link, deps, onStage);
      if (website?.ok) candidates.push({ draft: website.draft, source: 'web' });
    }
  }
  const best = candidates
    .filter((item) => scoreDraft(item.draft).saveable)
    .sort((a, b) => scoreDraft(b.draft).score - scoreDraft(a.draft).score)[0];
  if (best)
    return save(
      best.draft,
      best.source,
      meta?.source ?? payload.sourceName ?? 'shared post',
      onStage,
      deps,
      true,
      hintsFor(meta, audioReason),
    );
  onStage('failed');
  return failed(hintsFor(meta, audioReason));
}

async function safeWebsiteImport(
  url: string,
  deps: AutoImportDeps,
  onStage?: (stage: AutoStage) => void,
) {
  try {
    onStage?.('following_link');
    return await (
      deps.websiteImport ??
      (async (value) => {
        const result = await websiteAdapter.import({ url: value });
        return result.ok ? { ok: true, draft: result.draft } : { ok: false };
      })
    )(url);
  } catch {
    return null;
  }
}
function safePastedDraft(text: string, meta: SocialMeta): ImportDraft | null {
  try {
    return draftFromPastedText({
      text,
      sourceUrl: meta.canonicalUrl,
      sourceName: meta.source,
      adapterId: 'share-auto',
    });
  } catch {
    return null;
  }
}
function safeTranscriptDraft(
  text: string,
  meta: SocialMeta | null,
  segments?: { start: number; end: number; text: string }[],
): ImportDraft | null {
  try {
    return draftFromTranscript({
      text,
      segments,
      sourceUrl: meta?.canonicalUrl ?? null,
      sourceName: meta?.source ?? 'Photos',
    });
  } catch {
    return null;
  }
}
function hintsFor(meta: SocialMeta | null, reason: string): string[] | undefined {
  return meta?.source === 'instagram' && (reason === 'no_video_url' || reason === 'login_wall')
    ? ['ig_save_reel']
    : undefined;
}
async function save(
  draft: ImportDraft,
  source: 'caption' | 'audio' | 'web' | 'caption+audio',
  sourceName: string,
  onStage: (stage: AutoStage, progress?: number) => void,
  deps: AutoImportDeps,
  lowConfidence = false,
  hints?: string[],
): Promise<AutoImportResult> {
  const tagged = {
    ...draft,
    sourceName,
    notes: [draft.notes, `Imported automatically from ${source}.`].filter(Boolean).join(' '),
  };
  onStage('saving');
  let recipe: { id: string };
  try {
    recipe = (deps.commitImportDraft ?? ((value) => commitAutoImportDraft(value)))(tagged);
  } catch {
    onStage('failed');
    return failed(hints);
  }
  useAutoImportStore
    .getState()
    .setLast({
      recipeId: recipe.id,
      source: sourceName,
      lowConfidence: lowConfidence || source === 'audio' || source === 'caption+audio',
      hints,
    });
  onStage('saved');
  return {
    ok: true,
    recipe,
    draft: tagged,
    lowConfidence: lowConfidence || source === 'audio' || source === 'caption+audio',
    source,
    hints,
  };
}
