import type { DbClient } from '@/data/client';
import { getDatabase } from '@/data/database';
import { createCollectionRepository } from '@/data/repositories/collections';
import { createCompatRepository } from '@/data/repositories/compat';
import { createGroceryRepository } from '@/data/repositories/grocery';
import { createHouseholdRepository } from '@/data/repositories/households';
import { createLeftoversRepository } from '@/data/repositories/leftovers';
import { createMealPlanRepository } from '@/data/repositories/mealPlans';
import { createMealPlanTemplateRepository } from '@/data/repositories/templates';
import { createPantryRepository } from '@/data/repositories/pantry';
import { createRecipeRepository } from '@/data/repositories/recipes';
import { createTagRepository } from '@/data/repositories/tags';

export type Repositories = {
  recipes: ReturnType<typeof createRecipeRepository>;
  tags: ReturnType<typeof createTagRepository>;
  collections: ReturnType<typeof createCollectionRepository>;
  mealPlans: ReturnType<typeof createMealPlanRepository>;
  grocery: ReturnType<typeof createGroceryRepository>;
  households: ReturnType<typeof createHouseholdRepository>;
  pantry: ReturnType<typeof createPantryRepository>;
  templates: ReturnType<typeof createMealPlanTemplateRepository>;
  leftovers: ReturnType<typeof createLeftoversRepository>;
  compat: ReturnType<typeof createCompatRepository>;
};

export function createRepositories(db: DbClient): Repositories {
  return {
    recipes: createRecipeRepository(db),
    tags: createTagRepository(db),
    collections: createCollectionRepository(db),
    mealPlans: createMealPlanRepository(db),
    grocery: createGroceryRepository(db),
    households: createHouseholdRepository(db),
    pantry: createPantryRepository(db),
    templates: createMealPlanTemplateRepository(db),
    leftovers: createLeftoversRepository(db),
    compat: createCompatRepository(db),
  };
}

let cached: Repositories | null = null;

/** App singleton repositories (SQLite is source of truth). */
export function getRepositories(): Repositories {
  if (!cached) {
    cached = createRepositories(getDatabase());
  }
  return cached;
}

export function setRepositoriesForTests(repos: Repositories | null): void {
  cached = repos;
}

export {
  createCollectionRepository,
  createCompatRepository,
  createGroceryRepository,
  createHouseholdRepository,
  createLeftoversRepository,
  createMealPlanRepository,
  createMealPlanTemplateRepository,
  createPantryRepository,
  createRecipeRepository,
  createTagRepository,
};
