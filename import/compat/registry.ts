import { jsonAdapter } from '@/import/compat/adapters/jsonAdapter';
import { markdownAdapter } from '@/import/compat/adapters/markdownAdapter';
import { paprikaAdapter } from '@/import/compat/adapters/paprikaAdapter';
import type { CompatAdapter } from '@/import/compat/types';
import type { CompatFormat } from '@/data/contracts';

const defaultAdapters: CompatAdapter[] = [paprikaAdapter, jsonAdapter, markdownAdapter];

let adapters: CompatAdapter[] = [...defaultAdapters];

export function setCompatAdapters(next: CompatAdapter[]): void {
  adapters = next;
}

export function resetCompatAdapters(): void {
  adapters = [...defaultAdapters];
}

export function listCompatAdapters(): CompatAdapter[] {
  return [...adapters];
}

export function getCompatAdapter(id: string): CompatAdapter | undefined {
  return adapters.find((adapter) => adapter.id === id);
}

export function getCompatAdapterForFormat(format: CompatFormat): CompatAdapter | undefined {
  if (format === 'generic') {
    return adapters.find((adapter) => adapter.format === 'json');
  }
  return adapters.find((adapter) => adapter.format === format);
}

export function resolveCompatAdapter(input: {
  format?: CompatFormat;
  payload: string;
  adapterId?: string;
}): CompatAdapter | undefined {
  if (input.adapterId) {
    return getCompatAdapter(input.adapterId);
  }
  if (input.format) {
    const byFormat = getCompatAdapterForFormat(input.format);
    if (byFormat?.canHandle({ format: input.format, payload: input.payload })) {
      return byFormat;
    }
  }
  return adapters.find((adapter) =>
    adapter.canHandle({ format: input.format, payload: input.payload }),
  );
}
