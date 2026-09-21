# Import & Reel Fixtures — Manual Smoke Testing Guide

This document explains how to manually test recipe import from multiple sources (cooking websites, Instagram Reels, TikTok videos, YouTube Shorts, Facebook Reels, and Pinterest pins).

## Product Truth: URL + Caption, Not Binary Video

Whisk imports recipes via:

- **Website recipes**: JSON-LD structured data from public cooking sites
- **Social "reels"**: URL + caption/text pasted by the user (share sheet)

**There is no binary video pipeline yet.** Social video imports work via the Share Sheet by combining:
1. The public URL (e.g., `https://instagram.com/reel/abc123/`)
2. The post caption containing ingredients and steps (pasted by the user)

Do **not** scrape TikTok/Instagram video bytes or invent recipes from URLs alone. The system keeps honest stubs: if caption text is missing, it refuses to import rather than inventing content.

## Automated Test Fixtures

Fixtures are located in `__tests__/fixtures/import/`:

| Source | Fixture File | Purpose |
|--------|--------------|---------|
| Website (AllRecipes) | `website-allrecipes.json` | JSON-LD structured recipe from cooking website |
| Website (BBC Good Food) | `website-bbc-good-food.json` | JSON-LD structured recipe from BBC |
| Instagram | `instagram-reel.json` | Social reel with URL + caption text |
| TikTok | `tiktok-video.json` | Social video with URL + caption text |
| YouTube | `youtube-short.json` | YouTube Short with URL + caption text |
| Facebook | `facebook-reel.json` | Facebook reel with URL + caption text |
| Pinterest | `pinterest-pin.json` | Pinterest pin with URL + caption text |

### Running Fixture Tests

```bash
npm test -- __tests__/import.test.ts
```

Each fixture test verifies:
- ✅ Import succeeds with correct adapter
- ✅ Title is extracted correctly
- ✅ Minimum ingredient count met
- ✅ Minimum instruction count met
- ✅ Social URLs without caption are rejected (honest stub)

## Manual Smoke Testing

### A) Share Sheet Path (Device Testing)

When OS share hand-off is fully wired on device:

1. **Instagram Reel**:
   - Find a recipe reel on Instagram
   - Tap Share → Whisk
   - **Important**: Paste the full caption with ingredients and steps
   - Verify: Preview screen shows parsed recipe

2. **TikTok Video**:
   - Find a recipe video on TikTok (@foodchannel or similar)
   - Tap Share → Whisk
   - Paste the caption text with ingredients/steps
   - Verify: Recipe draft created with correct fields

3. **YouTube Short**:
   - Find a cooking short on YouTube (e.g., Tasty, Binging with Babish)
   - Share → Whisk
   - Paste caption/description with recipe text
   - Verify: Import succeeds

4. **Facebook Reel**:
   - Find a recipe reel on Facebook
   - Share → Whisk
   - Paste caption with ingredients and steps
   - Verify: Draft created with warnings about low confidence from social caption

### B) Manual Paste Workflow (Current Stub)

Until device share is fully connected, test via paste in the app:

1. Navigate to **Add** → **Share into Whisk**
2. In "Shared link or text" field, paste: `https://www.instagram.com/reel/abc123/`
3. In "Caption" field, paste complete recipe text (ingredients + steps)
4. Tap **Continue**
5. Verify: Preview screen shows the recipe with appropriate confidence warnings

### C) Website Recipe Import

Test with live public cooking websites (no caption needed for websites):

1. Navigate to **Add** → **Import from URL**
2. Try these URLs for **manual QA only** (not automated — network calls outside CI):

   **BBC Good Food** (JSON-LD structured data):
   - https://www.bbcgoodfood.com/recipes/easy-pancakes
   - Expected: Full recipe with ingredients, instructions, prep/cook time

   **Cookie + Kate** (JSON-LD structured data):
   - https://cookieandkate.com/best-hummus-recipe/
   - Expected: Complete recipe import with servings, timing, and author credit

   ⚠️ **Note**: AllRecipes and SimplyRecipes may return 403 errors to automated requests. Use the fixture-based tests in CI; manual QA URLs above are for real-device smoke testing only.

3. Verify:
   - Title, ingredients, and instructions are extracted
   - Prep/cook time shown when available
   - No warnings for high-quality structured data

### D) OCR Path (Manual Text Paste)

Until OCR ships, the photo path accepts manual text paste:

1. Navigate to **Add** → **Scan a photo**
2. Note: Photo picker is disabled (coming soon)
3. In "Manual text from photo" field, paste recipe text you see in a screenshot
4. Tap **Create draft from text**
5. Verify:
   - Draft created with ingredients and steps parsed
   - Warning banner: "Recipe text was typed manually from the photo"
   - Photo reference will be attached once picker is wired

### E) Rejection Paths (Honest Stubs)

**Social URL without caption** — should refuse to import:
```
Input: https://www.tiktok.com/@chef/video/123
Caption: (empty)
Expected: Error "This tiktok link needs the post caption to create a recipe..."
Fallbacks: paste_text, scan, manual, try_again
```

**OCR with image but no text** — should refuse to invent:
```
Input: imageUri only, no text
Expected: Error "Whisk saved a reference to your photo but cannot read it yet..."
Fallbacks: paste_text, manual, try_again
```

**Website without structured data** — should ask for manual input:
```
Input: https://example.com/blog-post (no JSON-LD)
Expected: Error code "needs_input"
Fallbacks: paste_text, scan, manual
```

## Fixture Content Guidelines

When adding new fixtures:

1. **Source must be realistic**: Use actual URL patterns (e.g., `https://www.instagram.com/reel/CxYz123abc/`)
2. **Website fixtures** require `htmlSnippet` with JSON-LD `<script type="application/ld+json">` containing schema.org Recipe
3. **Social fixtures** require `caption` with at least:
   - Title or description
   - 3+ ingredients (with quantities)
   - 2+ instruction steps
4. **Expectations** must match fixture content:
   - `ok: true` for valid recipes
   - `titleFragment`: substring to verify in extracted title
   - `minIngredients`: minimum ingredient count
   - `minInstructions`: minimum step count
   - `adapterId`: expected adapter ID (`website-jsonld` or `share-sheet`)

## Known Limitations

- **No video download**: Social imports require manual caption paste
- **No OCR yet**: Photo imports require manual text transcription
- **No live network in CI**: Fixture tests use static HTML/caption snippets
- **Share hand-off**: OS-level Share → Whisk may require native config (expo-share-intent / linking)

## Adding New Fixtures

To add a new source:

1. Create JSON fixture in `__tests__/fixtures/import/`:
   ```json
   {
     "source": "website|instagram|tiktok|youtube|facebook|pinterest",
     "url": "https://...",
     "htmlSnippet": "...",  // for website
     "caption": "...",      // for social
     "expect": {
       "ok": true,
       "titleFragment": "Recipe Name",
       "minIngredients": 5,
       "minInstructions": 3,
       "adapterId": "website-jsonld|share-sheet"
     }
   }
   ```

2. Import fixture in `__tests__/import.test.ts`:
   ```typescript
   'my-new-source.json': require('./fixtures/import/my-new-source.json'),
   ```

3. Run tests: `npm test -- __tests__/import.test.ts`

4. Add manual smoke URL to this doc if appropriate (live website only, not social)

---

## Questions?

- See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for workflow and test-first policy
- See [`architecture.md`](./architecture.md) for import pipeline design
- See [`data-layer.md`](./data-layer.md) for how recipes are stored after import
