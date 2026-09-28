import { File, Paths } from 'expo-file-system';
import type { SocialMeta } from '@/import/social/socialMeta';

export type VideoFailure =
  | 'no_video_url'
  | 'login_wall'
  | 'http_403'
  | 'http_error'
  | 'not_video'
  | 'too_large'
  | 'timeout'
  | 'network';
export type VideoDownload = {
  uri: string;
  size?: number;
  contentType?: string;
  delete?: () => void | Promise<void>;
};
export type VideoDeps = {
  downloadFile?: (
    url: string,
    options: { headers?: Record<string, string>; timeoutMs: number },
  ) => Promise<VideoDownload>;
  removeFile?: (uri: string) => Promise<void>;
};
const ALLOWED = [
  'cdninstagram.com',
  'fbcdn.net',
  'tiktok.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokv.com',
  'byteoversea.com',
  'ibyteimg.com',
];
export async function videoFromUrl(
  meta: Partial<SocialMeta>,
  deps: VideoDeps = {},
): Promise<
  { ok: true; uri: string; cleanup: () => Promise<void> } | { ok: false; reason: VideoFailure }
> {
  if (!meta.videoUrl) return { ok: false, reason: 'no_video_url' };
  let parsed: URL;
  try {
    parsed = new URL(meta.videoUrl);
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (
    parsed.protocol !== 'https:' ||
    !ALLOWED.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
  )
    return { ok: false, reason: 'network' };
  const destination = new File(
    Paths.cache,
    'whisk-share',
    `${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
  );
  let file: VideoDownload;
  try {
    file = deps.downloadFile
      ? await deps.downloadFile(meta.videoUrl, { headers: meta.videoHeaders, timeoutMs: 12_000 })
      : ((await File.downloadFileAsync(meta.videoUrl, destination, {
          headers: meta.videoHeaders,
          idempotent: true,
        })) as unknown as VideoDownload);
  } catch (error) {
    const status = (error as { status?: number }).status;
    return {
      ok: false,
      reason:
        status === 401 || status === 403
          ? 'http_403'
          : error instanceof DOMException && error.name === 'AbortError'
            ? 'timeout'
            : 'network',
    };
  }
  const uri = file.uri;
  const size = file.size ?? (file as any).info?.size;
  const type = file.contentType ?? '';
  if ((size ?? 0) > 150 * 1024 * 1024) {
    await (deps.removeFile?.(uri) ?? file.delete?.());
    return { ok: false, reason: 'too_large' };
  }
  if (type && !type.includes('mp4') && !type.includes('quicktime')) {
    await (deps.removeFile?.(uri) ?? file.delete?.());
    return { ok: false, reason: 'not_video' };
  }
  let cleaned = false;
  return {
    ok: true,
    uri,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      await (deps.removeFile?.(uri) ?? file.delete?.());
    },
  };
}
