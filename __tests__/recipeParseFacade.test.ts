let mockPresent = true;
const mockNative = { isFoundationModelsAvailable: jest.fn(() => true), parseRecipeWithFoundationModels: jest.fn() };
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => mockPresent ? mockNative : null }));
import { parseRecipeWithFoundationModels } from '@/modules/whisk-recipe-parse';

it('maps native errors and trims long unbroken input without collapsing it', async () => {
  mockPresent = true; mockNative.isFoundationModelsAvailable.mockReturnValue(true);
  mockNative.parseRecipeWithFoundationModels.mockRejectedValueOnce({ code: 'ERR_PARSE_FAILED' });
  await expect(parseRecipeWithFoundationModels('x')).resolves.toEqual({ ok: false, reason: 'parse_failed' });
  mockNative.parseRecipeWithFoundationModels.mockResolvedValueOnce({ title: 'T', ingredients: [], steps: [] });
  await parseRecipeWithFoundationModels('word '.repeat(4000));
  const passed = mockNative.parseRecipeWithFoundationModels.mock.calls[1][0] as string;
  expect(passed.length).toBeGreaterThanOrEqual(3000);
  expect(passed.length).toBeLessThanOrEqual(6000);
});
