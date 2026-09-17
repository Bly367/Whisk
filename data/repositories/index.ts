import type { DbClient } from '@/data/client';
import { getDatabase } from '@/data/database';
import { createCollectionRepository } from '@/data/repositories/collections';
import { createGroceryRepository } from '@/data/repositories/grocery';
import { createMealPlanRepository } from '@/data/repositories/mealPlans';
import { createRecipeRepository } from '@/data/repositories/recipes';
import { createTagRepository } from '@/data/repositories/tags';

export type Repositories = {
  recipes: ReturnType<typeof createRecipeRepository>;
  tags: ReturnType<typeof createTagRepository>;
  collections: ReturnType<typeof createCollectionRepository>;
  mealPlans: ReturnType<typeof createMealPlanRepository>;
  grocery: ReturnType<typeof createGroceryRepository>;
};

export function createRepositories(db: DbClient): Repositories {
  return {
    recipes: createRecipeRepository(db),
    tags: createTagRepository(db),
    collections: createCollectionRepository(db),
    mealPlans: createMealPlanRepository(db),
    grocery: createGroceryRepository(db),
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
  createGroceryRepository,
  createMealPlanRepository,
  createRecipeRepository,
  createTagRepository,
};
