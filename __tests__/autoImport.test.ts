import type { ImportDraft } from '@/import/types';
import { runAutoImport } from '@/import/autoImport';

const draft = (ingredients = 3, steps = 2): ImportDraft => ({
  id: `${ingredients}-${steps}`,
  sourceKind: 'share_sheet', sourceUrl: 'https://instagram.com/reel/1', sourceName: 'instagram', imageUri: null,
  title: 'Recipe', notes: null, servings: null, prepMinutes: null, cookMinutes: null,
  ingredients: Array.from({ length: ingredients }, (_, i) => ({ name: `ingredient ${i}`, position: i })),
  instructions: Array.from({ length: steps }, (_, i) => ({ id: `step-${i}`, text: `Cook ${i}`, position: i })),
  confidence: {}, warnings: [], sourceEvidence: null, adapterId: 'test', createdAt: new Date().toISOString(),
});

it('saves a passing caption before following its links', async () => {
  const stages: string[] = []; const websiteImport = jest.fn(); const commit = jest.fn(() => ({ id: 'r1' }));
  const result = await runAutoImport({ url: 'https://instagram.com/reel/1' }, {
    fetchSocialMeta: async () => ({ source: 'instagram', canonicalUrl: 'https://instagram.com/reel/1', caption: 'Ingredients:\n1 cup flour\n2 eggs\n1 tsp salt\nDirections:\nMix.\nBake.', linkedUrls: ['https://recipes.test/a'] }),
    websiteImport, commitImportDraft: commit,
  }, (stage) => stages.push(stage));
  expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption' }));
  expect(websiteImport).not.toHaveBeenCalled();
  expect(stages).toEqual(['receiving', 'fetching_caption', 'saving', 'saved']);
});

it.each(['fetchSocialMeta', 'websiteImport', 'videoFromUrl', 'transcribeVideo'] as const)(
  'does not reject when %s throws', async (dependency) => {
    const deps: any = { fetchSocialMeta: async () => ({ source: 'instagram', canonicalUrl: 'https://instagram.com/reel/1', linkedUrls: [] }) };
    if (dependency === 'fetchSocialMeta') deps.fetchSocialMeta = async () => { throw new Error('boom'); };
    if (dependency === 'websiteImport') { deps.fetchSocialMeta = async () => ({ source: 'instagram', canonicalUrl: 'https://instagram.com/reel/1', linkedUrls: ['https://recipes.test/a'] }); deps.websiteImport = async () => { throw new Error('boom'); }; }
    if (dependency === 'videoFromUrl') { deps.fetchSocialMeta = async () => ({ source: 'instagram', canonicalUrl: 'https://instagram.com/reel/1', linkedUrls: [], videoUrl: 'https://cdninstagram.com/a.mp4' }); deps.videoFromUrl = async () => { throw new Error('boom'); }; }
    if (dependency === 'transcribeVideo') { deps.fetchSocialMeta = async () => ({ source: 'instagram', canonicalUrl: 'https://instagram.com/reel/1', linkedUrls: [], videoUrl: 'https://cdninstagram.com/a.mp4' }); deps.videoFromUrl = async () => ({ ok: true, uri: '/cache/a.mp4', cleanup: async () => {} }); deps.transcribeVideo = async () => { throw new Error('boom'); }; }
    await expect(runAutoImport({ url: 'https://instagram.com/reel/1' }, deps)).resolves.toEqual(expect.objectContaining({ ok: false }));
  },
);
