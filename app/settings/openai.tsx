import { useEffect, useState } from 'react';
import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { clearOpenAIKey, readOpenAIKey, writeOpenAIKey } from '@/import/parse/openaiKey';

export default function OpenAISettingsScreen() {
  const [value, setValue] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void readOpenAIKey().then((key) => setHasSavedKey(Boolean(key))).catch(() => setHasSavedKey(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await writeOpenAIKey(value);
      setHasSavedKey(Boolean(value.trim()));
      setValue('');
      setMessage('OpenAI key saved on this device.');
    } catch {
      setMessage('Could not save the key. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setSaving(true);
    setMessage(null);
    try {
      await clearOpenAIKey();
      setHasSavedKey(false);
      setValue('');
      setMessage('OpenAI key removed from this device.');
    } catch {
      setMessage('Could not remove the key. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen testID="screen-openai-settings">
      <Text variant="title2">Recipe parsing</Text>
      <Text variant="body" tone="secondary">
        Foundation Models is tried first. This optional key is used only when that on-device
        parser is unavailable, recipe text is sent to OpenAI to structure it, and the key stays in the device keychain. Whisk never logs or stores
        the key in recipe data.
      </Text>
      <Field
        label="OpenAI API key"
        value={value}
        onChangeText={setValue}
        placeholder={hasSavedKey ? 'Key saved — enter a new one to replace it' : 'sk-...'}
        autoCapitalize="none"
        secureTextEntry
        testID="openai-key-input"
      />
      <Button label="Save key" loading={saving} onPress={() => void save()} testID="openai-save" />
      <Button
        label="Clear saved key"
        variant="tertiary"
        disabled={!hasSavedKey}
        loading={saving}
        onPress={() => void clear()}
        testID="openai-clear"
      />
      <Button label="Done" variant="secondary" onPress={() => router.back()} testID="openai-done" />
      {message ? <Text variant="caption" tone="secondary">{message}</Text> : null}
    </Screen>
  );
}
