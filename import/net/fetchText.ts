export type FetchTextOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
};
export type FetchTextResult = {
  status: number;
  finalUrl: string;
  text: string;
  setCookie?: string;
};

const DEFAULT_UA = 'Whisk/1.0 (recipe importer)';

export async function fetchText(
  url: string,
  options: FetchTextOptions = {},
): Promise<FetchTextResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml',
        ...options.headers,
      },
    });
    if (response.url && !response.url.startsWith('https:'))
      throw new Error('Insecure redirect rejected');
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > (options.maxBytes ?? 3 * 1024 * 1024)) throw new Error('Response too large');
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > (options.maxBytes ?? 3 * 1024 * 1024))
      throw new Error('Response too large');
    return {
      status: response.status,
      finalUrl: response.url || url,
      text,
      setCookie: response.headers.get('set-cookie') ?? undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}
