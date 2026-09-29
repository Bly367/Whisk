import { redirectSystemPath } from '@/app/+native-intent';

jest.mock('expo-share-intent', () => ({
  getShareExtensionKey: jest.fn(() => 'whiskShareKey'),
}));

describe('share native intent routing', () => {
  it.each(['whisk://dataUrl=whiskShareKey?nonce=x#weburl', 'dataUrl=whiskShareKey?nonce=x'])(
    'routes %s to the share screen',
    (path) => {
      expect(redirectSystemPath({ path, initial: true })).toBe('/import/share');
    },
  );

  it.each(['/recipe/abc', 'whisk:///import/url'])('passes %s through', (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });

  it('returns root when the share extension key lookup throws', () => {
    const { getShareExtensionKey } = jest.requireMock('expo-share-intent') as { getShareExtensionKey: jest.Mock };
    getShareExtensionKey.mockImplementationOnce(() => { throw new Error('missing key'); });
    expect(redirectSystemPath({ path: 'whisk://dataUrl=anything', initial: true })).toBe('/');
  });
});
