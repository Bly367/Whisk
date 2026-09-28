import { redirectSystemPath } from '@/app/+native-intent';

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
});
