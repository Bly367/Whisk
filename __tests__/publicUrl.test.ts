import { isPublicHttpsUrl } from '@/import/net/publicUrl';

it.each([
  'https://feasting.com/recipe',
  'https://feastingathome.com/recipe',
  'https://fdc.nal.usda.gov/food-details/1',
  'https://fcbarcelona.com/news',
])('allows ordinary public hostname %s', (url) => {
  expect(isPublicHttpsUrl(url)).toBe(true);
});

it.each([
  'https://127.0.0.1/recipe',
  'https://10.0.0.5/recipe',
  'https://[::1]/recipe',
  'https://[fd00::1]/recipe',
  'https://[::ffff:192.168.1.10]/recipe',
])('rejects private address %s', (url) => {
  expect(isPublicHttpsUrl(url)).toBe(false);
});
