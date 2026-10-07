import { Directory, File, Paths } from 'expo-file-system';
import type { SocialMeta } from '@/import/social/socialMeta';
import { isPublicHttpsUrl } from '@/import/net/publicUrl';

export type VideoFailure =
  | 'no_video_url'
  | 'login_wall'
  | 'http_403'
  | 'http_error'
  | 'not_video'
  | 'too_large'
  | 'timeout'
  | 'network'
  | 'host_blocked';
export type VideoDownload = {
  uri: string;
  size?: number;
  bytes?: Uint8Array;
  delete?: () => void | Promise<void>;
  open?: () => { readBytes: (length: number) => Uint8Array; close?: () => void | Promise<void> };
};
export type VideoDeps = {
  includeDetail?: boolean;
  createDirectory?: () => Promise<void>;
  downloadFile?: (
    url: string,
    options: { headers?: Record<string, string> },
  ) => Promise<VideoDownload>;
  removeFile?: (uri: string) => Promise<void>;
  readHeader?: (file: VideoDownload) => Uint8Array;
  timeoutMs?: number;
};
const safeDetail = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/[^\s)]+/gi, '')
    .replace(/\?[^\s)]+/g, '')
    .replace(/\b\S+\.\S+\/\S+/g, '')
    .trim() || undefined;
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
const cacheDir = () => new Directory(Paths.cache, 'whisk-share');

function failureFrom(error: unknown): VideoFailure {
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/status\s+(\d{3})/i)?.[1];
  if (status === '401' || status === '403') return 'http_403';
  if (status) return 'http_error';
  return 'network';
}

export async function sweepShareCache(): Promise<void> {
  try {
    const directory = cacheDir();
    for (const item of directory.list()) item.delete();
  } catch {
    // Cache cleanup is best-effort.
  }
}

export async function videoFromUrl(
  meta: Partial<SocialMeta>,
  deps: VideoDeps = {},
): Promise<
  { ok: true; uri: string; cleanup: () => Promise<void> } | { ok: false; reason: VideoFailure; detail?: string }
> {
  if (!meta.videoUrl || !isPublicHttpsUrl(meta.videoUrl))
    return { ok: false, reason: meta.videoUrl ? 'network' : 'no_video_url' };
  const parsed = new URL(meta.videoUrl);
  if (!ALLOWED.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)))
    return { ok: false, reason: 'host_blocked' };
  const directory = cacheDir();
  try {
    await (deps.createDirectory
      ? deps.createDirectory()
      : directory.create({ intermediates: true, idempotent: true }));
  } catch {
    return { ok: false, reason: 'network' };
  }
  const destination = new File(
    directory,
    `${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
  );
  let file: VideoDownload | undefined;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const download = deps.downloadFile
      ? deps.downloadFile(meta.videoUrl, { headers: meta.videoHeaders })
      : (File.downloadFileAsync(meta.videoUrl, destination, {
          headers: meta.videoHeaders,
          idempotent: true,
        }) as unknown as Promise<VideoDownload>);
    const downloadPromise = Promise.resolve(download);
    void downloadPromise.then(async (lateFile) => {
      if (timedOut) {
        try { await (deps.removeFile?.(lateFile.uri) ?? lateFile.delete?.()); } catch { /* best effort */ }
      }
    }).catch(() => {});
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { timedOut = true; reject(new Error('timeout')); }, deps.timeoutMs ?? 90_000);
    });
    file = await Promise.race([download, timeout]);
  } catch (error) {
    try {
      await (deps.removeFile?.(destination.uri) ?? destination.delete?.());
      if (file?.uri && file.uri !== destination.uri)
        await (deps.removeFile?.(file.uri) ?? file.delete?.());
    } catch {
      // Cleanup is best-effort when a native download failed or timed out.
    }
    if (error instanceof Error && error.message === 'timeout')
      return { ok: false, reason: 'timeout' };
    const detail = deps.includeDetail ? safeDetail(error) : undefined;
    return { ok: false, reason: failureFrom(error), ...(detail ? { detail } : {}) };
  } finally {
    if (timer) clearTimeout(timer);
  }
  const uri = file.uri;
  const remove = async () => {
    try {
      await (deps.removeFile?.(uri) ?? file?.delete?.());
    } catch {
      // Cleanup is best-effort.
    }
  };
  try {
    if ((file.size ?? 0) > 150 * 1024 * 1024) {
      await remove();
      return { ok: false, reason: 'too_large' };
    }
    const opened = file.open?.();
    let header: Uint8Array | undefined;
    try {
      header = deps.readHeader ? deps.readHeader(file) : opened ? opened.readBytes(12) : file.bytes;
    } finally {
      await opened?.close?.();
    }
    if (!header || header.length < 8 || String.fromCharCode(...header.slice(4, 8)) !== 'ftyp') {
      await remove();
      return { ok: false, reason: 'not_video' };
    }
  } catch {
    await remove();
    return { ok: false, reason: 'not_video' };
  }
  let cleaned = false;
  return {
    ok: true,
    uri,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      await remove();
    },
  };
}
