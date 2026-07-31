import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImportOption } from '../../components/ImportOption';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, spacing, typography } from '../../constants/theme';

export default function ImportScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Import"
          subtitle="Save recipes from anywhere in one tap."
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>From the web</Text>
          <ImportOption
            icon="link"
            title="Paste a link"
            subtitle="Instagram, TikTok, blogs, or any recipe URL"
            gradient={['#FF6B4A', '#FF8E53']}
            onPress={() => router.push('/import/url')}
          />
          <ImportOption
            icon="logo-instagram"
            title="Share from social apps"
            subtitle="Use Share To in Instagram, TikTok, or Facebook"
            gradient={['#833AB4', '#FD1D1D']}
            badge="MOBILE"
            onPress={() => router.push('/import/url')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Other ways</Text>
          <ImportOption
            icon="create"
            title="Add manually"
            subtitle="Type ingredients and steps yourself"
            gradient={['#2C5364', '#203A43']}
            onPress={() => router.push('/import/manual')}
          />
          <ImportOption
            icon="camera"
            title="From photo"
            subtitle="Snap a cookbook page or screenshot"
            gradient={['#11998e', '#38ef7d']}
            onPress={() => router.push('/import/photo')}
          />
          <ImportOption
            icon="sparkles"
            title="Generate with AI"
            subtitle="Describe what you want to cook"
            gradient={['#7C5CFF', '#B06CFF']}
            badge="SOON"
            onPress={() => router.push('/import/manual')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
});
