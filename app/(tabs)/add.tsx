import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { LimitNotice } from '@/components/trust/LimitNotice';
import { radius, spacing } from '@/constants/tokens';
import {
  describeUnlockOffer,
  FREE_TIER,
  gateImportAction,
  hasUnlimitedAccess,
  mayShowUpgradePrompt,
} from '@/features/trust/freeTier';
import { useSessionStore } from '@/features/trust/sessionStore';
import { useTheme } from '@/theme/ThemeProvider';

const SOURCES = [
  {
    id: 'link',
    label: 'Paste a link',
    hint: 'From a recipe site',
    href: '/import/url' as const,
    limited: true,
  },
  {
    id: 'social',
    label: 'Import from social',
    hint: 'Share sheet or saved post',
    href: '/import/share' as const,
    limited: true,
  },
  {
    id: 'scan',
    label: 'Scan a photo',
    hint: 'Cookbook page or screenshot',
    href: '/import/ocr' as const,
    limited: true,
  },
  {
    id: 'manual',
    label: 'Create manually',
    hint: 'Type it in yourself — never limited',
    href: '/import/manual' as const,
    limited: false,
  },
] as const;

export default function AddScreen() {
  const { colors } = useTheme();
  const usage = useSessionStore((s) => s.usage);
  const entitlement = useSessionStore((s) => s.entitlement);
  const unlockPricing = useSessionStore((s) => s.unlockPricing);
  const hydrate = useSessionStore((s) => s.hydrate);
  const recordImportStarted = useSessionStore((s) => s.recordImportStarted);
  const [status, setStatus] = useState<string | null>(null);

  const unlockCopy = useMemo(() => describeUnlockOffer(unlockPricing), [unlockPricing]);
  const unlimited = hasUnlimitedAccess(entitlement);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function onChooseSource(source: (typeof SOURCES)[number]) {
    setStatus(null);

    if (!source.limited) {
      router.push(source.href);
      return;
    }

    // Limits shown BEFORE the import starts — never mid-import.
    const gate = gateImportAction(usage, entitlement);
    if (!gate.allowed) {
      if (!mayShowUpgradePrompt('add_boundary')) {
        return;
      }
      Alert.alert('Import limit reached', gate.message, [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'View unlock',
          onPress: () => setStatus(`${gate.message} Unlock: ${unlockCopy}`),
        },
      ]);
      return;
    }

    if (gate.unlimited) {
      router.push(source.href);
      return;
    }

    Alert.alert(
      'Before you import',
      `${gate.remaining} of ${FREE_TIER.importsPerWeek} free imports left this week. Import review will not be interrupted by an upgrade screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void recordImportStarted().then(() => {
              router.push(source.href);
            });
          },
        },
      ],
    );
  }

  return (
    <Screen testID="screen-add" showSyncStatus={false}>
      <PlaceholderHero
        title="Add a recipe"
        body="Bring one in from a link, a share, a photo, or scratch. You’ll review it before it’s saved."
      />

      <LimitNotice usage={usage} entitlement={entitlement} unlockCopy={unlockCopy} />

      <View style={styles.list}>
        {SOURCES.map((source, index) => (
          <Pressable
            key={source.id}
            accessibilityRole="button"
            accessibilityLabel={`${source.label}. ${source.hint}`}
            onPress={() => void onChooseSource(source)}
            testID={`add-source-${source.id}`}
            style={({ pressed }) => [
              styles.sourceCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={[styles.numberBadge, { backgroundColor: colors.brand.yolk }]}>
              <Text variant="headline" style={{ color: colors.textOnYolk }}>{index + 1}</Text>
            </View>
            <View style={styles.sourceContent}>
              <Text variant="title2">{source.label}</Text>
              <Text variant="body" tone="secondary">
                {source.hint}
              </Text>
              {source.limited && !unlimited ? (
                <Text variant="caption" tone="info">
                  Counts toward {FREE_TIER.importsPerWeek}/week
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>

      {status ? (
        <Text variant="caption" tone="secondary" testID="add-status">
          {status}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  list: {
    gap: spacing.lg,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  numberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceContent: {
    flex: 1,
    gap: spacing.xs,
  },
});
