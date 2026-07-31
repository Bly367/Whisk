import { MealPlanSlot, MealType } from '../../types/recipe';

const mealTypes = new Set<MealType>(['breakfast', 'lunch', 'dinner']);

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date = new Date()): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  return result;
}

export function weekDates(offset = 0, today = new Date()): Date[] {
  const start = startOfWeek(today);
  start.setDate(start.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function normalizeMealPlan(value: unknown, today = new Date()): MealPlanSlot[] {
  if (!Array.isArray(value)) return [];
  const currentWeek = weekDates(0, today);

  return value.flatMap((entry, index): MealPlanSlot[] => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;

    if (
      typeof item.id === 'string' &&
      typeof item.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      typeof item.mealType === 'string' &&
      mealTypes.has(item.mealType as MealType) &&
      typeof item.recipeId === 'string' &&
      item.recipeId
    ) {
      return [{
        id: item.id,
        date: item.date,
        mealType: item.mealType as MealType,
        recipeId: item.recipeId,
        servings:
          typeof item.servings === 'number' && item.servings > 0 ? item.servings : 1,
      }];
    }

    if (
      typeof item.dayIndex === 'number' &&
      item.dayIndex >= 0 &&
      item.dayIndex < 7 &&
      typeof item.recipeId === 'string' &&
      item.recipeId
    ) {
      const date = dateKey(currentWeek[item.dayIndex]);
      return [{
        id: `migrated-${date}-dinner-${index}`,
        date,
        mealType: 'dinner',
        recipeId: item.recipeId,
        servings: 1,
      }];
    }
    return [];
  });
}
