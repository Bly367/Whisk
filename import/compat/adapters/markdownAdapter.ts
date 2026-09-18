import type { CookStep, IngredientInput } from '@/data/contracts';
import { createId, nowIso } from '@/data/util';
import { parseIngredientLine } from '@/import/parse/ingredients';
import type { ImportWarning } from '@/import/types';

import {
  aggregateConfidence,
  type CompatAdapter,
  type CompatAdapterParseResult,
  type CompatExportRecipe,
  type CompatImportDraft,
} from '@/import/compat/types';

export const MARKDOWN_ADAPTER_ID = 'compat-markdown' as const;

function parseMetaMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function sectionBody(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return [];
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^#{1,3}\s+/.test(line)) break;
    body.push(line);
  }
  return body;
}

function parseMarkdownRecipe(payload: string): CompatImportDraft | null {
  const lines = payload
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => !(line.trim() === '' && arr[index - 1]?.trim() === ''));

  const titleLine = lines.find((line) => /^#\s+/.test(line.trim()));
  if (!titleLine) return null;
  const title = titleLine.replace(/^#\s+/, '').trim();

  const meta: Record<string, string> = {};
  for (const line of lines) {
    const match = line.trim().match(/^(Servings|Prep|Cook|Source|URL)\s*:\s*(.+)$/i);
    if (match) {
      meta[match[1]!.toLowerCase()] = match[2]!.trim();
    }
  }

  const ingredientLines = sectionBody(lines, /^##\s+Ingredients\b/i)
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean);
  const ingredients: IngredientInput[] = ingredientLines
    .map((line, index) => parseIngredientLine(line, index))
    .filter((ing) => ing.name.trim().length > 0);

  const instructionLines = sectionBody(lines, /^##\s+(Instructions|Directions|Method|Steps)\b/i)
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean);
  const instructions: CookStep[] = instructionLines.map((text, index) => ({
    id: createId(),
    text,
    position: index,
  }));

  const notesLines = sectionBody(lines, /^##\s+Notes\b/i)
    .map((line) => line.trim())
    .filter(Boolean);

  const warnings: ImportWarning[] = [];
  if (!ingredients.length) {
    warnings.push({
      code: 'missing_ingredients',
      message: 'Markdown pack has no ingredients section.',
      field: 'ingredients',
    });
  }
  if (!instructions.length) {
    warnings.push({
      code: 'missing_instructions',
      message: 'Markdown pack has no instructions section.',
      field: 'instructions',
    });
  }

  const confidence = {
    title: 'high' as const,
    ingredients: ingredients.length ? ('medium' as const) : ('unknown' as const),
    instructions: instructions.length ? ('medium' as const) : ('unknown' as const),
    servings: meta.servings ? ('medium' as const) : ('unknown' as const),
    times: meta.prep || meta.cook ? ('medium' as const) : ('unknown' as const),
    notes: notesLines.length ? ('medium' as const) : ('unknown' as const),
  };

  return {
    id: createId(),
    format: 'markdown',
    adapterId: MARKDOWN_ADAPTER_ID,
    externalUid: null,
    title,
    notes: notesLines.length ? notesLines.join('\n') : null,
    sourceUrl: meta.url ?? null,
    sourceName: meta.source ?? null,
    imageUri: null,
    servings: parseMetaMinutes(meta.servings),
    prepMinutes: parseMetaMinutes(meta.prep),
    cookMinutes: parseMetaMinutes(meta.cook),
    rating: null,
    ingredients,
    instructions,
    tags: [],
    confidence,
    overallConfidence: aggregateConfidence(confidence),
    warnings,
    sourceEvidence: payload.slice(0, 4000),
    createdAt: nowIso(),
  };
}

function formatMarkdown(recipe: CompatExportRecipe): string {
  const lines: string[] = [`# ${recipe.title}`, ''];
  if (recipe.servings != null) lines.push(`Servings: ${recipe.servings}`);
  if (recipe.prepMinutes != null) lines.push(`Prep: ${recipe.prepMinutes} min`);
  if (recipe.cookMinutes != null) lines.push(`Cook: ${recipe.cookMinutes} min`);
  if (recipe.sourceName) lines.push(`Source: ${recipe.sourceName}`);
  if (recipe.sourceUrl) lines.push(`URL: ${recipe.sourceUrl}`);
  lines.push('', '## Ingredients', '');
  for (const ing of recipe.ingredients) {
    const text = [ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ');
    lines.push(`- ${text}`.trim());
  }
  lines.push('', '## Instructions', '');
  recipe.instructions
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((step, index) => {
      lines.push(`${index + 1}. ${step.text}`);
    });
  if (recipe.notes?.trim()) {
    lines.push('', '## Notes', '', recipe.notes.trim());
  }
  lines.push('');
  return lines.join('\n');
}

export const markdownAdapter: CompatAdapter = {
  id: MARKDOWN_ADAPTER_ID,
  format: 'markdown',
  label: 'Markdown',

  canHandle(input) {
    if (input.format && input.format !== 'markdown') return false;
    return /^#\s+/m.test(input.payload) && /##\s+/m.test(input.payload);
  },

  parse(payload: string): CompatAdapterParseResult {
    const draft = parseMarkdownRecipe(payload);
    if (!draft) {
      return {
        ok: false,
        error: {
          code: 'parse_failed',
          message: 'Markdown pack must start with a # title heading.',
        },
      };
    }
    return { ok: true, drafts: [draft] };
  },

  serialize(drafts: CompatExportRecipe[]): Record<string, unknown> {
    return {
      format: 'markdown',
      version: 1,
      documents: drafts.map((recipe) => ({
        id: recipe.id,
        markdown: formatMarkdown(recipe),
      })),
      markdown: drafts.map(formatMarkdown).join('\n---\n\n'),
    };
  },
};
