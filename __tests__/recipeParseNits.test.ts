import fs from 'node:fs';
import path from 'node:path';
import { parseRecipeText } from '@/import/parse/parseRecipeText';

it('uses time remaining after Foundation before OpenAI', async () => {
  const realNow = Date.now(); let offset = 0; const now = jest.spyOn(Date, 'now').mockImplementation(() => realNow + offset);
  const seen: number[] = [];
  const result = await parseRecipeText('1 cup flour. Mix flour.', {
    budget: { remaining: 2, deadline: realNow + 20_000 },
    foundation: async () => { offset += 12_000; return { ok: false as const, reason: 'parse_failed' as const }; },
    readApiKey: async () => 'sk-test',
    openAI: async (_text, options) => { seen.push(options.timeoutMs ?? 0); return { ok: false as const, reason: 'network' as const }; },
    heuristic: () => ({ title: 'T', ingredients: [{ name: 'flour' }], steps: ['Mix'], parser: 'heuristic' as const }),
  });
  now.mockRestore();
  expect(seen[0]).toBeLessThanOrEqual(8_000);
  expect(result?.adapterId).toBe('heuristic');
});

it('creates an import budget at the first parser attempt and cleans social captions once', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'import', 'autoImport.ts'), 'utf8');
  expect(source).toMatch(/deadline:\s*undefined/);
  const parser = fs.readFileSync(path.join(__dirname, '..', 'import', 'parse', 'parseRecipeText.ts'), 'utf8');
  expect((parser.match(/cleanSocialCaption\(/g) ?? []).length).toBe(2);
});
