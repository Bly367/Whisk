import { getShareExtensionKey } from 'expo-share-intent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const key = getShareExtensionKey({ scheme: 'whisk' });
    return path.includes(`dataUrl=${key}`) ? '/import/share' : path;
  } catch {
    return '/';
  }
}
