import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const ignored = (file: string) => {
  try { execFileSync('git', ['check-ignore', '--no-index', '-q', file], { cwd: root }); return true; } catch { return false; }
};

it('ships native recipe parser files while keeping generated ios ignored', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  expect(ignore).not.toMatch(/^ios\/$/m);
  for (const file of [
    'modules/whisk-recipe-parse/ios/WhiskRecipeParseModule.swift',
    'modules/whisk-recipe-parse/ios/WhiskRecipeParse.podspec',
    'modules/whisk-recipe-parse/ios/NewFile.swift',
    'modules/whisk-audio/ios/WhiskAudioModule.swift',
  ]) expect(ignored(file)).toBe(false);
  expect(ignored('ios/Foo.swift')).toBe(true);
  expect(fs.readFileSync(path.join(root, 'modules/whisk-recipe-parse/ios/WhiskRecipeParse.podspec'), 'utf8')).toContain("s.weak_frameworks = 'FoundationModels'");
});
