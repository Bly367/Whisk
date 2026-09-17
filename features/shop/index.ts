export { resolveAisle, aisleSortIndex, AISLE_ORDER } from '@/features/shop/aisle';
export {
  mergeGroceryLines,
  buildMergeKey,
  parseMergeKey,
  splitMergedDraft,
  encodeMergeKey,
  type GrocerySourceLine,
  type MergedGroceryDraft,
} from '@/features/shop/merge';
export {
  buildGroceryPreviewFromPlan,
  commitGroceryPreview,
  generateGroceryListFromPlan,
  type GroceryGeneratePreview,
} from '@/features/shop/generateFromPlan';
export {
  groupGroceryItems,
  completedItems,
  isMergedItem,
  type ShopGroupMode,
  type GroceryGroup,
} from '@/features/shop/groupItems';
export { unmergeGroceryItem } from '@/features/shop/unmerge';
export {
  replaceGroceryListFromPreview,
  undoReplaceGroceryList,
  type ReplaceGroceryResult,
} from '@/features/shop/replaceList';
export { startOfWeekMonday, formatWeekLabel } from '@/features/shop/week';
