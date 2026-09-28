import { videoFromUrl } from '@/import/social/videoFromUrl';

it('rejects missing or unsafe URLs before download', async () => {
  const download = jest.fn();
  const missing = await videoFromUrl({}, { downloadFile: download });
  const unsafe = await videoFromUrl(
    { videoUrl: 'http://evil.test/a.mp4' },
    { downloadFile: download },
  );
  expect(missing.ok ? null : missing.reason).toBe('no_video_url');
  expect(unsafe.ok ? null : unsafe.reason).toBe('network');
  expect(download).not.toHaveBeenCalled();
});

it('downloads an allowlisted video and cleanup is idempotent', async () => {
  const remove = jest.fn();
  const result = await videoFromUrl(
    { videoUrl: 'https://v16.tiktokcdn.com/a.mp4' },
    {
      downloadFile: async () => ({
        uri: 'file:///cache/whisk-share/a.mp4',
        size: 100,
        contentType: 'video/mp4',
      }),
      removeFile: remove,
    },
  );
  expect(result.ok).toBe(true);
  if (result.ok) {
    await result.cleanup();
    await result.cleanup();
  }
  expect(remove).toHaveBeenCalledTimes(1);
});

it('creates the share directory before downloading and rejects non-ftyp files', async () => {
  const create = jest.fn();
  const remove = jest.fn();
  const result = await videoFromUrl({ videoUrl: 'https://v16.tiktokcdn.com/a.mp4' }, {
    createDirectory: create,
    downloadFile: async () => ({ uri: 'file:///cache/a.mp4', size: 10, bytes: new Uint8Array(12) }),
    removeFile: remove,
  } as any);
  expect(create).toHaveBeenCalled();
  expect(result).toEqual({ ok: false, reason: 'not_video' });
  expect(remove).toHaveBeenCalled();
});

it('maps a native 403 response and timeout without throwing', async () => {
  await expect(videoFromUrl({ videoUrl: 'https://v16.tiktokcdn.com/a.mp4' }, {
    downloadFile: async () => { throw new Error('response has status 403'); },
  })).resolves.toEqual({ ok: false, reason: 'http_403' });
  await expect(videoFromUrl({ videoUrl: 'https://v16.tiktokcdn.com/a.mp4' }, {
    downloadFile: () => new Promise(() => {}), timeoutMs: 1,
  } as any)).resolves.toEqual({ ok: false, reason: 'timeout' });
});
