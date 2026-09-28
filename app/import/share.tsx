import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { runAutoImport, type AutoStage, type AutoImportPayload } from '@/import/autoImport';
import { consumeSharePayload } from '@/import/sharePayload';
import { useShareIntentContext } from 'expo-share-intent';

const stageCopy: Record<AutoStage, string> = {
  receiving: 'Receiving the shared post…',
  fetching_caption: 'Reading the post caption…',
  following_link: 'Checking the linked recipe…',
  downloading_video: 'Preparing the video…',
  downloading_model: 'Downloading the transcription model…',
  extracting_audio: 'Extracting audio…',
  transcribing: 'Transcribing the recipe…',
  saving: 'Saving recipe…',
  saved: 'Recipe saved.',
  failed: "Couldn't find a recipe in this post",
};

export default function ImportShareScreen() {
  const { hasShareIntent } = useShareIntentContext();
  const [payload, setPayload] = useState<AutoImportPayload | null>(null);
  const [stage, setStage] = useState<AutoStage>('receiving');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const run = useCallback(async (next: AutoImportPayload) => {
    setError(null);
    const result = await runAutoImport(next, {}, (nextStage) => setStage(nextStage));
    if (result.ok) router.replace(`/recipe/${result.recipe.id}`);
    else {
      setError(result.reason);
      setHint(result.hints?.includes('ig_save_reel') ?? false);
    }
  }, []);
  useEffect(() => {
    if (!hasShareIntent || payload) return;
    const pending = consumeSharePayload();
    if (!pending) return;
    const next = {
      url: pending.url,
      sharedText: pending.sharedText ?? pending.caption,
      videoPath: pending.videoPath,
      sourceName: pending.url,
    };
    setPayload(next);
    void run(next);
  }, [hasShareIntent, payload, run]);
  const chooseVideo = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (asset?.uri) {
      const next = { videoPath: asset.uri, sourceName: 'Photos' };
      setPayload(next);
      void run(next);
    }
  };
  return (
    <Screen testID="screen-import-share" showSyncStatus={false}>
      <View style={styles.center}>
        <Text variant="title1">{stageCopy[stage]}</Text>
        {error ? (
          <>
            <Text variant="body" tone="secondary">
              {error}
            </Text>
            {hint ? (
              <Text variant="body" tone="secondary">
                Save the reel, then share it from Photos to import from its audio
              </Text>
            ) : null}
            <Button label="Try again" onPress={() => payload && void run(payload)} />
            <Button label="Choose video" onPress={() => void chooseVideo()} />
            <Button label="Create manually" onPress={() => router.push('/import/manual')} />
          </>
        ) : (
          <Text variant="body" tone="secondary">
            Whisk will try the caption, linked recipe, and audio automatically.
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { gap: 16, paddingVertical: 32 } });
