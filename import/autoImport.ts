import { websiteAdapter } from '@/import/adapters/websiteAdapter';
import { commitAutoImportDraft, ImportCommitError, type CommitImportOptions } from '@/import/commit';
import { parseRecipeText, type ParseRecipeBudget } from '@/import/parse/parseRecipeText';
import { detectSource } from '@/import/parse/url';
import { fetchSocialMeta, type SocialMeta } from '@/import/social/socialMeta';
import { videoFromUrl } from '@/import/social/videoFromUrl';
import { transcribeVideo } from '@/import/transcribe';
import { AUTO_SAVE_MIN_INGREDIENTS, scoreDraft } from '@/import/score';
import type { ImportDraft } from '@/import/types';
import { useAutoImportStore } from '@/import/autoImportStore';
import { fetchText, type FetchTextResult } from '@/import/net/fetchText';
import { isPublicHttpsUrl } from '@/import/net/publicUrl';

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
  | 'reading_transcript'
  | 'transcribing'
  | 'saving'
  | 'saved'
  | 'failed';
export type AutoImportDeps = {
  fetchSocialMeta?: typeof fetchSocialMeta;
  videoFromUrl?: typeof videoFromUrl;
  transcribeVideo?: typeof transcribeVideo;
  websiteImport?: (url: string) => Promise<{ ok: true; draft: ImportDraft } | { ok: false }>;
  commitImportDraft?: (draft: ImportDraft, options?: CommitImportOptions & { allowIngredientsOnly?: boolean }) => { id: string };
  fetchText?: typeof fetchText;
};
export type ImportDiagnostic = { stage: AutoStage; code: string; detail?: string };
export const MAX_LLM_PARSES_PER_IMPORT = 2;
export const LLM_BUDGET_MS = 30_000;
export type AutoImportResult =
  | {
      ok: true;
      recipe: { id: string };
      draft: ImportDraft;
      lowConfidence: boolean;
      source: 'caption' | 'audio' | 'web' | 'caption+audio';
      hints?: string[];
      diagnostics: ImportDiagnostic[];
    }
  | {
      ok: false;
      reason: string;
      actions: ['try_again', 'choose_video', 'manual'];
      hints?: string[];
      diagnostics: ImportDiagnostic[];
    };

const failed = (diagnostics: ImportDiagnostic[], hints?: string[]): AutoImportResult => ({
  ok: false,
  reason: "Couldn't find a recipe in this post",
  actions: ['try_again', 'choose_video', 'manual'],
  hints,
  diagnostics,
});
export function diagnosticsText(diagnostics: ImportDiagnostic[], dev: boolean = __DEV__): string | null {
  return dev && diagnostics.length ? diagnostics.map(({ code, detail }) => detail ? `${code} (${detail})` : code).join('\n') : null;
}

export async function runAutoImport(
  payload: AutoImportPayload,
  deps: AutoImportDeps = {},
  onStage: (stage: AutoStage, progress?: number) => void = () => {},
): Promise<AutoImportResult> {
  const diagnostics: ImportDiagnostic[] = [];
  // LLM-backed parsing across caption/subtitle/whisper gets at most ~30 seconds per import.
  const parseBudget: ParseRecipeBudget = { remaining: MAX_LLM_PARSES_PER_IMPORT, deadline: undefined };
  try {
    return await runAutoImportUnsafe(payload, deps, onStage, diagnostics, parseBudget);
  } catch (error) {
    diagnostics.push({ stage: 'failed', code: `internal:${error instanceof Error ? error.name : 'Error'}` });
    onStage('failed');
    return failed(diagnostics);
  }
}

async function runAutoImportUnsafe(
  payload: AutoImportPayload,
  deps: AutoImportDeps,
  onStage: (stage: AutoStage, progress?: number) => void,
  diagnostics: ImportDiagnostic[],
  parseBudget: ParseRecipeBudget,
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
    const website = await safeWebsiteImport(payload.url, deps, onStage);
    if (website?.ok) {
      if (scoreDraft(website.draft).passes)
        return save(website.draft, 'web', 'website', onStage, deps, diagnostics);
      candidates.push({ draft: website.draft, source: 'web' });
    }
  } else if (!isLocal && payload.url) {
    onStage('fetching_caption');
    try {
      meta = await (deps.fetchSocialMeta ?? fetchSocialMeta)(payload.url);
    } catch {
      meta = null;
      diagnostics.push({ stage: 'fetching_caption', code: 'meta:throw' });
    }
    if (meta) {
      if (meta.blocked) diagnostics.push({ stage: 'fetching_caption', code: `meta:blocked:${meta.blocked}` });
      if (meta.source === 'tiktok' && meta.subtitleSummary !== undefined && !meta.transcriptUrl)
        diagnostics.push({ stage: 'fetching_caption', code: 'subtitle:no_track', detail: meta.subtitleSummary });
      const shared = payload.sharedText?.replace(/https?:\/\/\S+/gi, '').trim();
      const caption = [meta.caption, shared].filter(Boolean).join('\n\n');
      const parsed = caption ? await safePastedDraft(caption, meta, parseBudget) : null;
      if (parsed && captionCandidate(parsed)) candidates.push({ draft: parsed, source: 'caption' });
      const passingCaption = candidates.find(
        (item) => item.source === 'caption' && captionCandidate(item.draft) && scoreDraft(item.draft).passes,
      );
      if (passingCaption) return save(passingCaption.draft, 'caption', meta.source, onStage, deps, diagnostics);
      for (const link of meta.linkedUrls) {
        tried.add(link);
        const website = await safeWebsiteImport(link, deps, onStage);
        if (website?.ok) {
          candidates.push({ draft: website.draft, source: 'web' });
          if (scoreDraft(website.draft).passes)
            return save(website.draft, 'web', meta.source, onStage, deps, diagnostics);
        }
      }
    }
  }

  let cleanup: (() => Promise<void>) | undefined;
  let audioDraft: ImportDraft | null = null;
  if (!isLocal && meta?.transcriptUrl) {
    onStage('reading_transcript');
    const transcript = await readSubtitle(meta, deps, diagnostics);
    if (transcript) {
      const subtitleDraft = await safeTranscriptDraft(transcript, meta, undefined, parseBudget, payload.sharedText);
      const cap = candidates.find((item) => item.source === 'caption');
      if (cap && subtitleDraft && scoreDraft(cap.draft).ingredients >= 3 && scoreDraft(cap.draft).steps < 2 && scoreDraft(subtitleDraft).steps >= 2)
        return save({ ...cap.draft, instructions: subtitleDraft.instructions, adapterId: 'share-auto-merge' }, 'caption+audio', meta.source, onStage, deps, diagnostics, false, hintsFor(meta, audioReason));
      if (subtitleDraft && audioCandidate(subtitleDraft))
        return save(subtitleDraft, 'audio', meta.source, onStage, deps, diagnostics, true, hintsFor(meta, audioReason));
      diagnostics.push({ stage: 'reading_transcript', code: 'subtitle:no_draft' });
    }
  }
  let audioFailed = false;
  if (!isLocal && meta && !meta.videoUrl)
    diagnostics.push({ stage: 'downloading_video', code: 'video:no_video_url' });
  if (payload.videoPath || meta?.videoUrl) {
    let videoPath = payload.videoPath;
    if (!videoPath && meta) {
      onStage('downloading_video');
      try {
        const downloaded = await (deps.videoFromUrl ?? videoFromUrl)(meta, { includeDetail: true });
        if (downloaded.ok) {
          videoPath = downloaded.uri;
          cleanup = downloaded.cleanup;
        } else {
          audioReason = downloaded.reason; audioFailed = true;
          const host = new URL(meta.videoUrl ?? '').hostname;
          diagnostics.push({ stage: 'downloading_video', code: `video:${downloaded.reason}`, detail: `host=${host} cookie=${meta.videoHeaders?.Cookie ? 'yes' : 'no'} setCookieSeen=${meta.setCookieSeen ? 'yes' : 'no'}${downloaded.detail ? ` ${downloaded.detail}` : ''}` });
        }
      } catch {
        audioReason = 'network';
        audioFailed = true; diagnostics.push({ stage: 'downloading_video', code: 'video:throw' });
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
        if (result.ok) {
          audioDraft = await safeTranscriptDraft(result.transcript, meta, result.metadata.segments, parseBudget, payload.sharedText);
          if (!audioDraft) diagnostics.push({ stage: 'transcribing', code: 'transcribe:no_draft' });
        } else {
          audioFailed = true;
          diagnostics.push({ stage: 'transcribing', code: `transcribe:${result.error.code}:${result.error.details?.code ?? ''}` });
        }
      } catch {
        audioReason = 'transcription_failed';
        audioFailed = true; diagnostics.push({ stage: 'transcribing', code: 'transcribe:throw' });
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
        deps, diagnostics,
        false,
        hintsFor(meta, audioReason),
      );
    }
    if (audioCandidate(audioDraft)) {
      if (cleanup) await cleanup();
      return save(
        audioDraft,
        'audio',
        meta?.source ?? payload.sourceName ?? 'Photos',
        onStage,
        deps, diagnostics,
        scoreDraft(audioDraft).ingredients < AUTO_SAVE_MIN_INGREDIENTS,
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
      diagnostics, true,
      hintsFor(meta, audioReason),
    );
  const caption = candidates.find((item) => item.source === 'caption');
  if (caption && audioFailed && qualifiedCaptionOnly(caption.draft)) {
    const note = "Steps weren't in the caption. Add them, or save the video and share it from Photos to transcribe it.";
    return save({ ...caption.draft, notes: [caption.draft.notes, note].filter(Boolean).join('\n') }, 'caption', meta?.source ?? 'shared post', onStage, deps, diagnostics, true, hintsFor(meta, audioReason), { allowIngredientsOnly: true });
  }
  if (caption) diagnostics.push({ stage: 'failed', code: 'caption:not_saveable', detail: `${scoreDraft(caption.draft).ingredients} ingredients, ${scoreDraft(caption.draft).steps} steps` });
  onStage('failed');
  return failed(diagnostics, hintsFor(meta, audioReason));
}
function qualifiedCaptionOnly(draft: ImportDraft) {
  return draft.ingredients.filter((item) => item.name.trim() && (item.quantity || item.unit)).length >= 5 && !draft.title.startsWith('Recipe from') && scoreDraft(draft).steps === 0;
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
async function safePastedDraft(text: string, meta: SocialMeta, budget: ParseRecipeBudget): Promise<ImportDraft | null> {
  try {
    const social = ['instagram', 'tiktok', 'facebook', 'youtube', 'pinterest'].includes(meta.source);
    return await parseRecipeText(text, {
      sourceKind: 'share_sheet',
      sourceUrl: meta.canonicalUrl,
      sourceName: meta.source,
      adapterId: 'share-auto',
      heuristicKind: social ? 'social' : 'paste',
      budget,
    });
  } catch {
    return null;
  }
}

function captionCandidate(draft: ImportDraft): boolean {
  const quantified = draft.ingredients.filter((item) => item.name.trim().length >= 2 && (item.quantity || item.unit)).length;
  const steps = draft.instructions.filter((step) => step.text.trim()).length;
  return (quantified >= 2 && steps >= 1) || (quantified >= 3 && steps === 0);
}

function audioCandidate(draft: ImportDraft): boolean {
  if (scoreDraft(draft).passes) return true;
  if (scoreDraft(draft).steps < 3) return false;
  const meaningful = draft.instructions.filter((step) =>
    /\b(?:add|air fry|bake|boil|bring|chop|combine|cook|crack|dice|drizzle|finish|flip|fold|heat|make|marinate|melt|mix|pat|place|pour|preheat|reduce|remove|roast|season|serve|simmer|slice|stir|toss|whisk|blend|let|sear|sprinkle|top|garnish|transfer|cover|brown|knead|roll|shape)\s+\w+|\b\d+(?:\.\d+)?\s*(?:minutes?|mins?|degrees?|°[FC])\b/i.test(step.text),
  ).length;
  return meaningful >= 2;
}

export function subtitleText(vtt: string): string {
  const cues = vtt.split(/\r?\n\s*\r?\n/).map((block) => block.split(/\r?\n/).filter((line) => line.trim() && !/^WEBVTT/i.test(line) && !/^\d+$/.test(line.trim()) && !/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->/.test(line)).join(' ').trim()).filter(Boolean);
  if (!cues.length) return '';
  const punctuated = cues.filter((cue) => /[.,!?;:]$/.test(cue)).length / cues.length >= 0.3;
  if (punctuated) return vtt.replace(/^WEBVTT[^\n]*\n/i, '').split(/\r?\n/).filter((line) => line.trim() && !/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->/.test(line) && !/^\d+$/.test(line.trim())).join(' ');
  const dangling = /\b(?:your|the|a|an|and|or|with|of|in|into|to|some|my)$/i;
  const joined: string[] = [];
  for (let index = 0; index < cues.length; index += 1) {
    let cue = cues[index];
    while (dangling.test(cue) && index + 1 < cues.length) cue += ` ${cues[++index]}`;
    joined.push(/[.!?]$/.test(cue) ? cue : `${cue}.`);
  }
  return joined.join(' ');
}
async function readSubtitle(meta: SocialMeta, deps: AutoImportDeps, diagnostics: ImportDiagnostic[]): Promise<string | null> {
  const value = meta.transcriptUrl;
  if (!value || !isPublicHttpsUrl(value)) { diagnostics.push({ stage: 'reading_transcript', code: 'subtitle:host_blocked' }); return null; }
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (!['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktok.com'].some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) { diagnostics.push({ stage: 'reading_transcript', code: 'subtitle:host_blocked' }); return null; }
    const result: FetchTextResult = await (deps.fetchText ?? fetchText)(value, { headers: meta.videoHeaders, maxBytes: 256 * 1024 });
    if (result.status < 200 || result.status >= 300) { diagnostics.push({ stage: 'reading_transcript', code: `subtitle:http_${result.status}` }); return null; }
    if (result.text.length > 256 * 1024) { diagnostics.push({ stage: 'reading_transcript', code: 'subtitle:too_large' }); return null; }
    const text = subtitleText(result.text);
    if (!text) diagnostics.push({ stage: 'reading_transcript', code: 'subtitle:empty' });
    return text || null;
  } catch {
    diagnostics.push({ stage: 'reading_transcript', code: 'subtitle:network' });
    return null;
  }
}
async function safeTranscriptDraft(
  text: string,
  meta: SocialMeta | null,
  segments?: { start: number; end: number; text: string }[],
  budget?: ParseRecipeBudget,
  payloadSharedText?: string,
): Promise<ImportDraft | null> {
  try {
    return await parseRecipeText(text, {
      sourceKind: 'share_sheet',
      segments,
      sourceUrl: meta?.canonicalUrl ?? null,
      sourceName: meta?.source ?? 'Photos',
      adapterId: 'transcript',
      sharedText: meta?.caption ?? payloadSharedText?.replace(/https?:\/\/\S+/gi, '').trim() ?? null,
      heuristicKind: 'transcript',
      budget,
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
  diagnostics: ImportDiagnostic[],
  lowConfidence = false,
  hints?: string[],
  options?: CommitImportOptions & { allowIngredientsOnly?: boolean },
): Promise<AutoImportResult> {
  const tagged = {
    ...draft,
    sourceName,
    notes: [source === 'audio' ? `Transcript: ${(draft.sourceEvidence ?? '').slice(0, 4000)}` : null, draft.notes, `Imported automatically from ${source}.`].filter(Boolean).join('\n'),
  };
  onStage('saving');
  let recipe: { id: string };
  try {
    recipe = (deps.commitImportDraft ?? ((value, commitOptions) => commitAutoImportDraft(value, commitOptions)))(tagged, options);
  } catch (error) {
    diagnostics.push({ stage: 'saving', code: `commit:${error instanceof ImportCommitError ? error.code : error instanceof Error ? error.name : 'Error'}` });
    onStage('failed');
    return failed(diagnostics, hints);
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
    diagnostics,
  };
}
