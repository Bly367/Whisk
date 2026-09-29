import { useSharePayloadStore } from '@/import/sharePayloadStore';

const payload = { url: 'https://example.com/post', sharedText: 'recipe' };

describe('share payload store', () => {
  beforeEach(() => useSharePayloadStore.setState({ payload: null }));

  it('takes a payload that arrives after the subscriber mounts exactly once', () => {
    const seen: unknown[] = [];
    const unsubscribe = useSharePayloadStore.subscribe((state) => seen.push(state.payload));
    useSharePayloadStore.getState().setPayload(payload);
    expect(useSharePayloadStore.getState().payload).toEqual(payload);
    useSharePayloadStore.getState().takePayload();
    expect(useSharePayloadStore.getState().payload).toBeNull();
    expect(useSharePayloadStore.getState().takePayload()).toBeNull();
    expect(seen).toEqual([payload, null]);
    unsubscribe();
  });

  it('replaces a queued payload without taking it twice', () => {
    useSharePayloadStore.getState().setPayload(payload);
    useSharePayloadStore.getState().setPayload({ ...payload, sharedText: 'new' });
    expect(useSharePayloadStore.getState().takePayload()?.sharedText).toBe('new');
    expect(useSharePayloadStore.getState().takePayload()).toBeNull();
  });
});
