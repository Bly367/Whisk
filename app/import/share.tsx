import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { diagnosticsText, runAutoImport, type AutoStage, type AutoImportPayload } from '@/import/autoImport';
import { useSharePayloadStore } from '@/import/sharePayloadStore';

const stageCopy: Record<AutoStage, string> = {
  receiving: 'Receiving the shared post…',
  fetching_caption: 'Reading the post caption…',
  following_link: 'Checking the linked recipe…',
  downloading_video: 'Preparing the video…',
  downloading_model: 'Downloading the transcription model…',
  extracting_audio: 'Extracting audio…',
  reading_transcript: "Reading the video's captions…",
  transcribing: 'Transcribing the recipe…',
  saving: 'Saving recipe…',
  saved: 'Recipe saved.',
  failed: "Couldn't find a recipe in this post",
};

export default function ImportShareScreen() {
  const payload = useSharePayloadStore((state) => state.payload);
  const takePayload = useSharePayloadStore((state) => state.takePayload);
  const [activePayload, setActivePayload] = useState<AutoImportPayload | null>(null);
  const [stage, setStage] = useState<AutoStage>('receiving');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const running = useRef(false);
  const run = useCallback(async function runImport(next: AutoImportPayload) {
    if (running.current) return;
    running.current = true;
    try {
      setError(null);
      const result = await runAutoImport(next, {}, (nextStage) => setStage(nextStage));
      if (__DEV__) console.warn('[share-import]', JSON.stringify(result.diagnostics));
      if (result.ok) router.replace(`/recipe/${result.recipe.id}`);
      else {
        setError(result.reason);
        setHint(result.hints?.includes('ig_save_reel') ?? false);
        setDiagnostics(diagnosticsText(result.diagnostics));
      }
    } catch (error) {
      setStage('failed');
      setError(error instanceof Error ? error.message : "Couldn't find a recipe in this post");
      setHint(false);
      setDiagnostics(null);
    } finally {
      running.current = false;
      const pending = takePayload();
      if (pending) {
        const queued = {
          url: pending.url,
          sharedText: pending.sharedText ?? pending.caption,
          videoPath: pending.videoPath,
          sourceName: pending.url,
        };
        setActivePayload(queued);
        void runImport(queued);
      }
    }
  }, [takePayload]);
  useEffect(() => {
    if (!payload || running.current) return;
    const pending = takePayload();
    if (!pending) return;
    const next = {
      url: pending.url,
      sharedText: pending.sharedText ?? pending.caption,
      videoPath: pending.videoPath,
      sourceName: pending.url,
    };
    setActivePayload(next);
    void run(next);
  }, [payload, takePayload, run]);
  const chooseVideo = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (asset?.uri) {
      const next = { videoPath: asset.uri, sourceName: 'Photos' };
      setActivePayload(next);
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
            {diagnostics ? <Text testID="share-import-diagnostics" variant="body" tone="secondary">{diagnostics}</Text> : null}
            {hint ? (
              <Text variant="body" tone="secondary">
                Save the reel, then share it from Photos to import from its audio
              </Text>
            ) : null}
            <Button label="Try again" onPress={() => activePayload && void run(activePayload)} />
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
