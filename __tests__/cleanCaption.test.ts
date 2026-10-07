import fs from 'node:fs';
import path from 'node:path';
import { cleanSocialCaption } from '@/import/social/cleanCaption';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');

it('moves comment-for-recipe CTA text to notes and keeps a useful title', () => {
  const cleaned = cleanSocialCaption(fixture('ig-comment-yes.html').match(/name="description" content="([\s\S]*?)"/i)?.[1] ?? '', 'Instagram');
  expect(cleaned.title).toBe('Crispy chicken alfredo tacos with alfredo dipping sauce');
  expect(cleaned.notes).toMatch(/comment.*yes|DM|full recipe.*website/i);
  expect(cleaned.text).not.toMatch(/comment.*yes|link in bio|#tacos/i);
});

it('cleans bulgogi sections and assigns ingredient groups', () => {
  const cleaned = cleanSocialCaption(fixture('tiktok-bulgogi-contents.txt'), 'TikTok');
  expect(cleaned.title).toBe('GROUND BEEF BULGOGI');
  expect(cleaned.text).not.toMatch(/^Main$|^Sauce$|A quick|\*Sub:/m);
  expect(cleaned.groups.get('ground beef')).toBe('Main');
  expect(cleaned.groups.get('brown sugar')).toBe('Sauce');
});

it('keeps an ingredients-only tortellini caption recipe-ready without steps', () => {
  const cleaned = cleanSocialCaption(`Creamy, Spicy Tortellini and Sausage Soup ❤️‍🔥\n\nThis one’s comfort in a bowl.\n\nIngredients below, full recipe in my bio!\n\n1 tbsp unsalted butter\n1 tbsp olive oil\n1 lb Italian sausage (hot or mild)\n1 medium yellow onion, finely diced\n2 stalks celery, finely diced\n2 medium carrots, finely diced\n6–8 cloves garlic, minced, to taste\n1 tsp dried basil\n1 tsp dried oregano\n½ tsp dried thyme\n½ tsp dried rosemary\n1–2 tsp Calabrian chilies\n3 tbsp tomato paste\n3 tbsp all-purpose flour\n½ cup dry white wine\n28 oz crushed tomatoes\n4 cups low-sodium chicken broth\n1 Parmesan rind (optional)\n1 bay leaf\n½ cup heavy cream\n2 cups spinach\n10–12 oz cheese tortellini\n1 cup freshly grated Parmesan\nLemon zest\nFresh basil, for garnish\n#soup #recipes`, 'TikTok');
  expect(cleaned.ingredients.length).toBeGreaterThanOrEqual(24);
  expect(cleaned.text).not.toMatch(/#soup|full recipe|bio/i);
  expect(cleaned.notes).toMatch(/comfort in a bowl/i);
});
