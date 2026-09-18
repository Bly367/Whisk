# Compatibility import/export (P2-W6)

Paprika and common-format (JSON / Markdown) packs behind replaceable adapters in `@/import/compat`.

## Import rules (MVP)

1. **Parse → preview → confirm → commit.** Adapters only produce `CompatImportDraft`s and a `CompatImportJob` with `status: 'preview'`.
2. **Confidence before commit.** Each draft carries field-level confidence plus an aggregate `overallConfidence` stored on the job. Low-confidence fields surface as warnings — nothing is invented by AI.
3. **No silent recipe writes.** `previewCompatImport` never calls `recipes.create`. Callers must invoke `commitCompatImport` after the user reviews the preview.

## URL schemes (SECURITY.md §5)

Untrusted pack fields (`source_url` / `sourceUrl`, `image_url` / `imageUri`) are allowlisted at **parse and commit**:

| Allowed | Rejected (nulled) |
| --- | --- |
| `https:` | `file:`, `javascript:`, `data:`, `http:`, and any unexpected scheme |
| `whisk-compat:` on **source** only (uid embedding when no https source) | — |

Hostile schemes must not survive into committed recipe rows. Rejected URLs surface as `unsupported_source` warnings on the preview draft.

## Conflict / clobber policy

| Policy | Behavior |
| --- | --- |
| `skip` (**default**) | Matching recipes are left untouched. User-edited rows (`localRevision > 1` or `updatedAt !== createdAt`) are reported as `skipped` with reason `user_edited`. |
| `create_new` | Always insert a new recipe (may duplicate). |
| `overwrite` | Explicit only — updates the matched recipe. Never implied. |

Matching keys (`matchExistingBy`):

- `externalUid` — Paprika `uid` embedded into `sourceUrl` as `whisk_compat_uid` (or `whisk-compat://paprika/<uid>` when no URL exists)
- `sourceUrl` — normalized URL compare (compat uid query param ignored)
- `none` — always create

**Round-trip:** export → re-import **preview** does not mutate the library. Re-commit with default `skip` will not clobber existing recipes that match by uid/URL.

## Formats

| Adapter id | Format | Notes |
| --- | --- | --- |
| `compat-paprika` | `paprika` | Uncompressed Paprika recipe JSON (single object, array, or `{ recipes: [...] }`) |
| `compat-json` | `json` / `generic` | `whisk-compat-json` pack |
| `compat-markdown` | `markdown` | `# Title` + `## Ingredients` / `## Instructions` |

Adapters are replaceable via `setCompatAdapters` / `resetCompatAdapters` (same pattern as MVP website/OCR importers).

## Export

`buildCompatExportPack` serializes selected recipes through the format adapter and stores a `CompatExportPack` (`status: 'ready'`) via `getRepositories().compat`.

## Out of scope

- AI cleanup / rewrite of imported text
- Social scrapers beyond existing MVP adapters
- Gzip `.paprikarecipe` / zip `.paprikarecipes` archives (callers may inflate first)
