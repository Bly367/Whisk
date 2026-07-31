import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImportProgress } from '../../components/ImportProgress';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useRecipeStore } from '../../store/recipeStore';

export default function ImportPhotoScreen() {
  const startImageImport = useRecipeStore((state) => state.startImageImport);
  const currentImport = useRecipeStore((state) => state.currentImport);
  const clearImport = useRecipeStore((state) => state.clearImport);
  const [loading, setLoading] = useState(false);

  const runImport = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setLoading(true);
    try {
      await startImageImport(asset.uri, asset.mimeType ?? 'image/jpeg');
      router.push('/import/review');
    } catch {
      // Error shown via currentImport state
    } finally {
      setLoading(false);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to import cookbook pages.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    await runImport(result);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to snap a cookbook page.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
    });
    await runImport(result);
  };

  const busy = loading || currentImport?.status === 'extracting';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="From photo"
        subtitle="Snap a cookbook page or choose a screenshot."
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={takePhoto} disabled={busy} style={[styles.option, busy && styles.disabled]}>
          <Text style={styles.optionTitle}>Take photo</Text>
          <Text style={styles.optionBody}>Use your camera on a printed recipe</Text>
        </Pressable>
        <Pressable onPress={pickFromLibrary} disabled={busy} style={[styles.option, busy && styles.disabled]}>
          <Text style={styles.optionTitle}>Choose from gallery</Text>
          <Text style={styles.optionBody}>Import a screenshot or saved photo</Text>
        </Pressable>

        {busy ? <ImportProgress status="extracting" /> : null}

        {currentImport?.status === 'failed' ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Import failed</Text>
            <Text style={styles.errorBody}>{currentImport.error}</Text>
          </View>
        ) : null}

        {currentImport ? (
          <Pressable onPress={clearImport}>
            <Text style={styles.note}>Clear and try again</Text>
          </Pressable>
        ) : (
          <Text style={styles.note}>
            Whisk reads text from your photo and opens the same review screen before saving.
          </Text>
        )}

        {busy ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Reading recipe from photo...</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  disabled: { opacity: 0.55 },
  optionTitle: { ...typography.subtitle, color: colors.text },
  optionBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.xs,
  },
  errorTitle: { ...typography.subtitle, color: colors.danger },
  errorBody: { ...typography.body, color: colors.textSecondary, fontSize: 14 },
  note: { ...typography.caption, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...typography.caption, color: colors.textSecondary },
});
