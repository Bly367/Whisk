import { websiteAdapter } from '@/import/adapters/websiteAdapter';
import { commitAutoImportDraft } from '@/import/commit';
import { draftFromPastedText } from '@/import/parse/pasteText';
import { draftFromTranscript } from '@/import/parse/transcript';
import { fetchSocialMeta, type SocialMeta } from '@/import/social/socialMeta';
import { videoFromUrl } from '@/import/social/videoFromUrl';
import { transcribeVideo } from '@/import/transcribe';
import { scoreDraft } from '@/import/score';
import type { ImportDraft } from '@/import/types';

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

export async function runAutoImport(
  payload: AutoImportPayload,
  deps: AutoImportDeps = {},
  onStage: (stage: AutoStage, progress?: number) => void = () => {},
): Promise<AutoImportResult> {
  onStage('receiving');
  const isLocal = Boolean(payload.videoPath);
  let meta: SocialMeta | null = null;
  const candidates: {
    draft: ImportDraft;
    source: 'caption' | 'audio' | 'web' | 'caption+audio';
  }[] = [];
  if (!isLocal && payload.url) {
    onStage('fetching_caption');
    meta = await (deps.fetchSocialMeta ?? fetchSocialMeta)(payload.url);
    const caption = [meta.caption, payload.sharedText].filter(Boolean).join('\n\n');
    const parsed = caption
      ? draftFromPastedText({
          text: caption,
          sourceUrl: meta.canonicalUrl,
          sourceName: meta.source,
          adapterId: 'share-auto',
        })
      : null;
    const spoken = caption
      ? draftFromTranscript({
          text: caption,
          sourceUrl: meta.canonicalUrl,
          sourceName: meta.source,
        })
      : null;
    if (parsed) candidates.push({ draft: parsed, source: 'caption' });
    if (spoken && (!parsed || scoreDraft(spoken).score > scoreDraft(parsed).score))
      candidates.push({ draft: spoken, source: 'caption' });
    const links = meta.linkedUrls;
    for (const link of links) {
      onStage('following_link');
      const result = await (
        deps.websiteImport ??
        (async (url) => {
          const r = await websiteAdapter.import({ url });
          return r.ok ? { ok: true, draft: r.draft } : { ok: false };
        })
      )(link);
      if (result.ok) candidates.push({ draft: result.draft, source: 'web' });
      if (result.ok && scoreDraft(result.draft).passes)
        return save(result.draft, 'web', meta.source, onStage, deps);
    }
    const cap = candidates.find((x) => scoreDraft(x.draft).passes);
    if (cap) return save(cap.draft, cap.source, meta.source, onStage, deps);
  }
  let audioDraft: ImportDraft | null = null;
  let audioReason = 'no_video_url';
  let cleanup: (() => Promise<void>) | undefined;
  if (payload.videoPath || meta?.videoUrl) {
    onStage('downloading_video');
    let videoPath = payload.videoPath;
    if (!videoPath && meta) {
      const downloaded = await (deps.videoFromUrl ?? videoFromUrl)(meta);
      if (downloaded.ok) {
        videoPath = downloaded.uri;
        cleanup = downloaded.cleanup;
      } else audioReason = downloaded.reason;
    }
    if (videoPath) {
      onStage('extracting_audio');
      onStage('transcribing');
      const result = await (deps.transcribeVideo ?? transcribeVideo)(videoPath, {
        onProgress: (stage, progress) =>
          onStage(stage === 'extracting' ? 'extracting_audio' : 'transcribing', progress),
      });
      if (result.ok) {
        audioDraft = draftFromTranscript({
          text: result.transcript,
          segments: result.metadata.segments,
          sourceUrl: meta?.canonicalUrl ?? null,
          sourceName: meta?.source ?? payload.sourceName ?? 'Photos',
        });
        if (audioDraft) {
          const cap = candidates.find((x) => x.source === 'caption');
          if (
            cap &&
            scoreDraft(cap.draft).ingredients >= 3 &&
            scoreDraft(cap.draft).steps < 2 &&
            scoreDraft(audioDraft).steps >= 2
          ) {
            const merged = {
              ...cap.draft,
              instructions: audioDraft.instructions,
              adapterId: 'share-auto-merge',
            };
            if (cleanup) await cleanup();
            return save(merged, 'caption+audio', meta?.source ?? 'Photos', onStage, deps);
          }
          if (scoreDraft(audioDraft).passes) {
            if (cleanup) await cleanup();
            return save(audioDraft, 'audio', meta?.source ?? 'Photos', onStage, deps);
          }
          candidates.push({ draft: audioDraft, source: 'audio' });
        }
      }
    }
  }
  if (cleanup) await cleanup();
  const best = candidates
    .filter((x) => scoreDraft(x.draft).saveable)
    .sort((a, b) => scoreDraft(b.draft).score - scoreDraft(a.draft).score)[0];
  if (best)
    return save(
      best.draft,
      best.source,
      meta?.source ?? payload.sourceName ?? 'shared post',
      onStage,
      deps,
      true,
    );
  const hints =
    meta?.source === 'instagram' && ['no_video_url', 'login_wall'].includes(audioReason)
      ? ['ig_save_reel']
      : undefined;
  onStage('failed');
  return {
    ok: false,
    reason: "Couldn't find a recipe in this post",
    actions: ['try_again', 'choose_video', 'manual'],
    hints,
  };
}

async function save(
  draft: ImportDraft,
  source: 'caption' | 'audio' | 'web' | 'caption+audio',
  sourceName: string,
  onStage: (stage: AutoStage, progress?: number) => void,
  deps: AutoImportDeps,
  lowConfidence = false,
): Promise<AutoImportResult> {
  const tagged = {
    ...draft,
    sourceName,
    notes: [draft.notes, `Imported automatically from ${source}.`].filter(Boolean).join(' '),
  };
  onStage('saving');
  const recipe = (deps.commitImportDraft ?? ((value) => commitAutoImportDraft(value)))(tagged);
  onStage('saved');
  return {
    ok: true,
    recipe,
    draft: tagged,
    lowConfidence: lowConfidence || source === 'audio' || source === 'caption+audio',
    source,
  };
}
