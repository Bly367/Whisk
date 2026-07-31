import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import {
  addBoundedImportHistory,
  ImportHistoryEntry,
  IMPORT_HISTORY_LIMIT,
} from '../importHistoryStore';

function entry(index: number): ImportHistoryEntry {
  return {
    id: `import-${index}`,
    kind: 'url',
    source: 'url',
    timestamp: new Date(index).toISOString(),
    status: 'success',
    draftTitle: `Recipe ${index}`,
  };
}

describe('import history bounds', () => {
  it('keeps only the newest 25 entries', () => {
    const history = Array.from({ length: IMPORT_HISTORY_LIMIT }, (_, index) => entry(index));
    const newest = entry(IMPORT_HISTORY_LIMIT);

    const result = addBoundedImportHistory(history, newest);

    expect(result).toHaveLength(IMPORT_HISTORY_LIMIT);
    expect(result[0]).toEqual(newest);
    expect(result).not.toContainEqual(entry(IMPORT_HISTORY_LIMIT - 1));
  });

  it('replaces duplicate IDs without growing the history', () => {
    const result = addBoundedImportHistory([entry(1), entry(2)], {
      ...entry(2),
      status: 'failed',
      draftTitle: undefined,
      errorCode: 'network',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'import-2', status: 'failed' });
  });
});
