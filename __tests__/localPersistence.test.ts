import {
  assertDomainWritePath,
  mayCelebrateSuccess,
  resolveSyncStatus,
  statusAfterLocalWrite,
} from '../lib/standards/localPersistence';

/**
 * Contract tests for local-first persistence rules.
 *
 * RNTL note: React Native Testing Library samples wait on W1 (Expo app +
 * jest-expo runtime). Until then, this pure Jest suite must still fail if
 * sync/celebration or write-path rules regress.
 */
describe('localPersistence contracts', () => {
  describe('statusAfterLocalWrite', () => {
    it('marks successful repository writes as saved locally', () => {
      expect(statusAfterLocalWrite({ persisted: true })).toBe('saved_locally');
    });

    it('surfaces needs_attention when local persistence fails', () => {
      expect(statusAfterLocalWrite({ persisted: false })).toBe('needs_attention');
    });
  });

  describe('mayCelebrateSuccess', () => {
    it('never celebrates when local persistence failed', () => {
      expect(mayCelebrateSuccess({ localPersisted: false, syncComplete: true })).toBe(false);
    });

    it('allows celebration only after local persistence succeeds', () => {
      expect(mayCelebrateSuccess({ localPersisted: true })).toBe(true);
      expect(mayCelebrateSuccess({ localPersisted: true, syncComplete: false })).toBe(true);
    });
  });

  describe('resolveSyncStatus', () => {
    it('keeps needs_attention when local write failed even if sync reports success', () => {
      expect(resolveSyncStatus({ localPersisted: false, sync: 'success' })).toBe('needs_attention');
    });

    it('maps sync lifecycle after a successful local write', () => {
      expect(resolveSyncStatus({ localPersisted: true, sync: 'idle' })).toBe('saved_locally');
      expect(resolveSyncStatus({ localPersisted: true, sync: 'in_progress' })).toBe('syncing');
      expect(resolveSyncStatus({ localPersisted: true, sync: 'success' })).toBe('synced');
      expect(resolveSyncStatus({ localPersisted: true, sync: 'failure' })).toBe('needs_attention');
    });
  });

  describe('assertDomainWritePath', () => {
    it('allows repository writes', () => {
      expect(() => assertDomainWritePath('repository')).not.toThrow();
    });

    it('rejects Zustand and ad-hoc SQLite as domain write paths', () => {
      expect(() => assertDomainWritePath('zustand')).toThrow(/Invalid domain write path/);
      expect(() => assertDomainWritePath('ad_hoc_sqlite')).toThrow(/Invalid domain write path/);
    });
  });
});
