import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ImportFallbacks } from '@/components/import/ImportFallbacks';
import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { runImport, SHARE_SHEET_ADAPTER_ID, useImportSessionStore } from '@/import';
import { consumePendingSharePayload } from '@/import/pendingSharePayload';
import { transcribeVideo } from '@/import/transcribe';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Share-sheet entry point.
 * Receives shared content from OS share intents or manual paste.
 * Supports video transcription for social media recipes.
 */
export default function ImportShareScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ url?: string; caption?: string }>();
  const [shared, setShared] = useState('');
  const [caption, setCaption] = useState('');
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const phase = useImportSessionStore((s) => s.phase);
  const error = useImportSessionStore((s) => s.error);
  const setImporting = useImportSessionStore((s) => s.setImporting);
  const setPreview = useImportSessionStore((s) => s.setPreview);
  const setFailed = useImportSessionStore((s) => s.setFailed);
  const clear = useImportSessionStore((s) => s.clear);
  
  // Track whether we've initialized from params to prevent overwriting user edits
  const initializedFromParams = useRef(false);

  const loading = phase === 'importing';
  const hasVideo = Boolean(videoPath);

  // Pre-fill fields from OS share intent (store first, then query params as fallback)
  useEffect(() => {
    if (!initializedFromParams.current) {
      // First try to consume pending payload from in-memory store (consume-once)
      const pending = consumePendingSharePayload();
      
      if (pending) {
        if (pending.url) {
          setShared(pending.url);
        }
        if (pending.caption) {
          setCaption(pending.caption);
        }
        if (pending.videoPath) {
          setVideoPath(pending.videoPath);
        }
        // imagePath handled by OCR screen, not here
      } else {
        // Fallback to query params for manual paste or legacy navigation
        if (params.url) {
          setShared(params.url);
        }
        if (params.caption) {
          setCaption(params.caption);
        }
      }
      
      initializedFromParams.current = true;
    }
  }, [params.url, params.caption]);

  const handleTranscribe = async () => {
    if (!videoPath) return;
    
    setTranscribing(true);
    setTranscribeProgress(0);
    
    try {
      const result = await transcribeVideo(videoPath, {
        language: 'en',
        modelSize: 'tiny',
        onProgress: (stage, progress) => {
          // Map extracting (0-0.3) and transcribing (0.3-1.0) to 0-1 range
          const overallProgress = stage === 'extracting' 
            ? progress * 0.3 
            : 0.3 + progress * 0.7;
          setTranscribeProgress(overallProgress);
        },
      });
      
      if (result.ok) {
        // Feed transcript into caption field for user review before import
        setCaption(result.transcript);
        setVideoPath(null); // Clear video after successful transcription
      } else {
        setFailed({
          code: 'native_unavailable',
          message: result.error.message,
          fallbacks: ['paste_text', 'manual'],
        });
      }
    } catch (err) {
      setFailed({
        code: 'native_unavailable',
        message: err instanceof Error ? err.message : 'Transcription failed unexpectedly',
        fallbacks: ['paste_text', 'manual'],
      });
    } finally {
      setTranscribing(false);
      setTranscribeProgress(0);
    }
  };

  const handleImport = async () => {
    setImporting();
    
    const result = await runImport(
      {
        sharedContent: shared.trim() || undefined,
        text: caption.trim() || undefined,
        url: shared.trim() || undefined,
      },
      SHARE_SHEET_ADAPTER_ID,
    );
    if (result.ok) {
      setPreview(result.draft);
      router.push('/import/preview');
      return;
    }
    setFailed(result.error);
  };

  return (
    <Screen testID="screen-import-share" showSyncStatus={false}>
      {hasVideo ? (
        <PlaceholderHero
          title="Video ready to transcribe"
          body="Whisk will transcribe the audio from your video to extract the recipe. Transcription happens on-device and stays private. After transcription, you can review and edit the text before importing."
        />
      ) : (
        <PlaceholderHero
          title="Share into Whisk"
          body="Import recipes from Instagram, TikTok, YouTube Shorts, Facebook Reels, or cooking websites. For social posts with video, save the video to Photos first, then share the video file to Whisk for transcription. For URL-only shares, paste the caption text manually."
        />
      )}

      {hasVideo && !caption ? (
        <View style={styles.field}>
          <Text variant="headline">Shared video</Text>
          <Text variant="body" tone="secondary">
            Video file ready for transcription. Tap &ldquo;Transcribe Video&rdquo; below to extract recipe text
            from the audio.
          </Text>
          <View
            style={[
              styles.videoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text variant="body" tone="secondary">
              📹 {videoPath?.split('/').pop() || 'Video file'}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <Text variant="headline">Shared link or text</Text>
            <TextInput
              value={shared}
              onChangeText={setShared}
              placeholder="Paste the shared URL or post text"
              placeholderTextColor={colors.textSecondary}
              multiline
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              testID="share-content-input"
              accessibilityLabel="Shared content"
            />
          </View>

          <View style={styles.field}>
            <Text variant="headline">Caption {hasVideo ? '(from video)' : '(required for social posts)'}</Text>
            <Text variant="caption" tone="secondary">
              {hasVideo
                ? 'Transcribed from video audio. Review and edit before importing.'
                : 'For Instagram Reels, TikTok videos, or YouTube Shorts without video file: paste the complete post caption here. Or save the Reel/video to Photos and share the video file to Whisk for automatic transcription.'}
            </Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Paste the post caption or recipe text"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[
                styles.input,
                styles.tall,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              testID="share-caption-input"
              accessibilityLabel="Post caption"
            />
          </View>
        </>
      )}

      {transcribing ? (
        <View style={styles.progressCard}>
          <Text variant="headline">Transcribing video...</Text>
          <Text variant="body" tone="secondary">
            {transcribeProgress < 0.3 ? 'Extracting audio...' : 'Transcribing speech...'}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.sunken }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.brand.yolk, width: `${transcribeProgress * 100}%` },
              ]}
            />
          </View>
        </View>
      ) : null}

      {error && phase === 'failed' ? (
        <View
          style={[
            styles.errorCard,
            { borderColor: colors.warning, backgroundColor: colors.sunken },
          ]}
          testID="share-error"
        >
          <Text variant="headline" tone="warning">
            Share sheet
          </Text>
          <Text variant="body" tone="secondary">
            {error.message}
          </Text>
          <ImportFallbacks
            actions={error.fallbacks}
            onTryAgain={() => {
              clear();
              void handleImport();
            }}
          />
        </View>
      ) : null}

      {hasVideo && !caption && !transcribing ? (
        <Button
          label="Transcribe Video"
          onPress={handleTranscribe}
          testID="transcribe-button"
        />
      ) : null}

      <Button
        label="Continue"
        onPress={handleImport}
        loading={loading}
        disabled={transcribing}
        testID="share-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
    textAlignVertical: 'top',
  },
  tall: {
    minHeight: 120,
  },
  videoCard: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
  },
  progressCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  errorCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
