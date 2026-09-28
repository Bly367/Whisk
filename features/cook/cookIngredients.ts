export function ingredientsForCookStep<T extends { name: string }>(ingredients: T[], stepText: string): T[] {
  const text = stepText.toLowerCase();
  const matched = ingredients.filter((ingredient) => {
    const words = ingredient.name.toLowerCase().replace(/\([^)]*\)/g, '').split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !['and', 'for', 'the', 'with', 'sauce'].includes(word));
    return words.some((word) => {
      const singular = word.endsWith('oes') || word.endsWith('ies') ? word.replace(/(?:oes|ies)$/, word.endsWith('ies') ? 'y' : 'o') : word.endsWith('es') ? word.slice(0, -2) : word.endsWith('s') ? word.slice(0, -1) : word;
      return new RegExp(`\\b${singular}(?:s|es)?\\b`, 'i').test(text);
    });
  });
  return matched.length > 0 ? matched : ingredients;
}
