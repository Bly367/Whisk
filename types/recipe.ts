export type RecipeSource =
  | 'url'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'manual'
  | 'photo'
  | 'video'
  | 'cookbook';

export type ImportStatus =
  | 'idle'
  | 'resolving'
  | 'extracting'
  | 'structuring'
  | 'review'
  | 'needs_input'
  | 'failed';

export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

export interface ImportEvidence {
  kind: 'json-ld' | 'page-text' | 'caption' | 'metadata' | 'user-text' | 'image' | 'video';
  value: string;
  sourceUrl?: string;
}

export interface ImportWarning {
  code:
    | 'missing_ingredients'
    | 'missing_instructions'
    | 'missing_quantities'
    | 'private_or_unavailable'
    | 'unsupported_source'
    | 'low_confidence';
  message: string;
  field?: keyof RecipeDraft;
}

export interface Ingredient {
  id: string;
  amount: string;
  unit: string;
  name: string;
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  imageGradient: [string, string];
  imageUrl?: string;
  source: RecipeSource;
  sourceUrl?: string;
  canonicalUrl?: string;
  sourceAttribution?: string;
  folderIds: string[];
  prepTime?: number;
  cookTime?: number;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  nutrition?: Nutrition;
  tags: string[];
  createdAt: string;
}

export interface RecipeDraft {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageGradient: [string, string];
  source: RecipeSource;
  sourceUrl?: string;
  canonicalUrl?: string;
  sourceAttribution?: string;
  prepTime?: number;
  cookTime?: number;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  nutrition?: Nutrition;
  tags: string[];
  evidence: ImportEvidence[];
  warnings: ImportWarning[];
  confidence: Partial<Record<'title' | 'ingredients' | 'steps' | 'servings' | 'times' | 'nutrition', Confidence>>;
}

export interface ImportJob {
  id: string;
  status: ImportStatus;
  input: string;
  draft?: RecipeDraft;
  error?: string;
}

export interface Folder {
  id: string;
  name: string;
  emoji: string;
  color: string;
}
