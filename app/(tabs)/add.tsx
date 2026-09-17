import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
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
        {SOURCES.map((source) => (
          <View
            key={source.id}
            style={[
              styles.row,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.rowCopy}>
              <Text variant="headline">{source.label}</Text>
              <Text variant="caption" tone="secondary">
                {source.hint}
                {source.limited && !unlimited
                  ? ` · counts toward ${FREE_TIER.importsPerWeek}/week`
                  : ''}
              </Text>
            </View>
            <Button
              label={source.limited ? 'Import' : 'Create'}
              variant={source.limited ? 'secondary' : 'primary'}
              testID={`add-source-${source.id}`}
              accessibilityHint={`Open ${source.label}`}
              onPress={() => void onChooseSource(source)}
            />
          </View>
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
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    minHeight: 72,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
