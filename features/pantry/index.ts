export {
  formatPantryCoverageLabel,
  normalizePantryName,
  pantryNamesMatch,
  scorePantryCoverage,
  type PantryCoverage,
} from '@/features/pantry/coverage';

export {
  applyPantryAwareSearch,
  describePantrySearchMode,
  type PantryAwareRecipe,
  type PantryNameSource,
  type PantrySearchMode,
} from '@/features/pantry/search';

export {
  isPantryUiSoftDeleteAllowed,
  PANTRY_UI_MUTATIONS,
  refusePantryUiSoftDelete,
  type PantryUiMutation,
} from '@/features/pantry/destructivePolicy';

export { PantryScreen } from '@/features/pantry/PantryScreen';
