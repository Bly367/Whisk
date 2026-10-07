import type { ParsedShareIntent } from '@/import/shareIntent';

let payload: ParsedShareIntent | null = null;
export function setSharePayload(next: ParsedShareIntent | null): void {
  payload = next;
}
export function consumeSharePayload(): ParsedShareIntent | null {
  const next = payload;
  payload = null;
  return next;
}
