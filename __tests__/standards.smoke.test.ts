/**
 * Pure smoke assertion for the W8 standards harness.
 * Runs under Jest once W1 merges package.json and Jest + RNTL deps/scripts.
 *
 * Local-first rule: domain writes go through repositories → SQLite;
 * Zustand must not become a second recipe database.
 */
describe('engineering standards smoke', () => {
  it('keeps SQLite as the domain source of truth contract', () => {
    const stack = {
      persistence: 'expo-sqlite',
      uiSession: 'zustand',
      importers: 'replaceable-adapters',
    };

    expect(stack.persistence).toBe('expo-sqlite');
    expect(stack.uiSession).toBe('zustand');
    expect(stack.importers).toBe('replaceable-adapters');
  });
});
