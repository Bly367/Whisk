import * as SecureStore from 'expo-secure-store';

export const OPENAI_API_KEY_STORAGE_KEY = 'whisk.openai.apiKey.v1';

export async function readOpenAIKey(): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(OPENAI_API_KEY_STORAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export async function writeOpenAIKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) {
    await clearOpenAIKey();
    return;
  }
  await SecureStore.setItemAsync(OPENAI_API_KEY_STORAGE_KEY, trimmed);
}

export async function clearOpenAIKey(): Promise<void> {
  await SecureStore.deleteItemAsync(OPENAI_API_KEY_STORAGE_KEY);
}
