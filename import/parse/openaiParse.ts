import type { ParsedRecipe } from '@/import/parse/structured';

export const OPENAI_RECIPE_MODEL = 'gpt-4o-mini';

export type OpenAIParseResult =
  | { ok: true; recipe: ParsedRecipe }
  | { ok: false; reason: 'http' | 'network' | 'parse_failed' | 'unavailable' };

const recipeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          quantity: { type: ['string', 'null'] },
          unit: { type: ['string', 'null'] },
          name: { type: 'string' },
          note: { type: ['string', 'null'] },
        },
        required: ['quantity', 'unit', 'name', 'note'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'ingredients', 'steps'],
} as const;

function isRecipe(value: unknown): value is Omit<ParsedRecipe, 'parser'> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { title?: unknown; ingredients?: unknown; steps?: unknown };
  return typeof candidate.title === 'string'
    && Array.isArray(candidate.ingredients)
    && candidate.ingredients.every((item) => item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string')
    && Array.isArray(candidate.steps)
    && candidate.steps.every((step) => typeof step === 'string');
}
function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null;
}

export async function parseRecipeWithOpenAI(
  sourceText: string,
  options: {
    apiKey: string;
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
  },
): Promise<OpenAIParseResult> {
  if (!options.apiKey.trim()) return { ok: false, reason: 'unavailable' };
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) return { ok: false, reason: 'unavailable' };
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeout = controller ? setTimeout(() => controller.abort(), options.timeoutMs ?? 15000) : undefined;
  try {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_RECIPE_MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: 'Extract only the recipe stated in the user text. Do not invent ingredients or steps.' },
          { role: 'user', content: sourceText },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'whisk_recipe', strict: true, schema: recipeSchema },
        },
      }),
      signal: controller?.signal,
    });
    if (!response.ok) return { ok: false, reason: 'http' };
    let body: { choices?: { message?: { content?: string | { text?: string }[] } }[] };
    try { body = await response.json() as typeof body; } catch { return { ok: false, reason: 'parse_failed' }; }
    const content = body.choices?.[0]?.message?.content;
    const json = typeof content === 'string' ? content : content?.map((part) => part.text ?? '').join('');
    if (!json) return { ok: false, reason: 'parse_failed' };
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { return { ok: false, reason: 'parse_failed' }; }
    if (!isRecipe(parsed)) return { ok: false, reason: 'parse_failed' };
    return { ok: true, recipe: { ...parsed, ingredients: parsed.ingredients.map((ingredient) => ({ ...ingredient, quantity: stringOrNull(ingredient.quantity), unit: stringOrNull(ingredient.unit), note: stringOrNull(ingredient.note) })), parser: 'openai' } };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
