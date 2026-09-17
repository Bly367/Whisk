import { useEffect, useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { GuestModeBanner } from '@/components/trust/GuestModeBanner';
import { LimitNotice } from '@/components/trust/LimitNotice';
import { spacing } from '@/constants/tokens';
import {
  createOfflineReader,
  getDatabase,
  getRepositories,
} from '@/data';
import {
  buildExportFromRepos,
  exportPayloadToJson,
} from '@/features/trust/exportRecipes';
import {
  describeTrialOffer,
  FREE_TIER,
} from '@/features/trust/freeTier';
import { useSessionStore } from '@/features/trust/sessionStore';

function trialRenewalLabel(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + FREE_TIER.trialDays);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProfileScreen() {
  const mode = useSessionStore((s) => s.mode);
  const usage = useSessionStore((s) => s.usage);
  const hydrate = useSessionStore((s) => s.hydrate);
  const setDowngraded = useSessionStore((s) => s.setDowngraded);
  const [exporting, setExporting] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const trialCopy = useMemo(
    () => describeTrialOffer(trialRenewalLabel()),
    [],
  );

  useEffect(() => {
    void hydrate();
    try {
      const reader = createOfflineReader(getDatabase());
      setTrashCount(reader.listTrashedRecipes().length);
    } catch {
      setTrashCount(0);
    }
  }, [hydrate]);

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    try {
      const db = getDatabase();
      const repos = getRepositories();
      const reader = createOfflineReader(db);
      const payload = buildExportFromRepos(repos, reader, mode);
      if (payload.recipes.length === 0) {
        setMessage('No recipes to export yet. Save one, then try again.');
        return;
      }
      const json = exportPayloadToJson(payload);
      await Share.share({
        title: 'Whisk recipe export',
        message: json,
      });
      setMessage(
        `Exported ${payload.recipes.length} recipe${payload.recipes.length === 1 ? '' : 's'} as JSON. Available anytime — including after downgrade.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not export. Your recipes are still saved locally.',
      );
    } finally {
      setExporting(false);
    }
  }

  function handleRestoreTrash() {
    const repos = getRepositories();
    const reader = createOfflineReader(getDatabase());
    const trashed = reader.listTrashedRecipes();
    if (trashed.length === 0) {
      setMessage('Trash is empty.');
      return;
    }
    let restored = 0;
    for (const item of trashed) {
      repos.recipes.restore(item.id);
      restored += 1;
    }
    setTrashCount(0);
    setMessage(
      restored === 1
        ? 'Restored 1 recipe from trash.'
        : `Restored ${restored} recipes from trash.`,
    );
  }

  function handleDeleteAccountStub() {
    Alert.alert(
      'Delete local data',
      'Guest mode has no cloud account. Deleting removes recipes, plans, and lists stored on this device. Export first if you want a copy. Cloud account deletion will follow the same path when sign-in ships.',
      [
        { text: 'Keep data', style: 'cancel' },
        {
          text: 'Understood',
          style: 'destructive',
          onPress: () =>
            setMessage(
              'Account deletion is stubbed safely for guest mode. Export anytime; no silent wipe.',
            ),
        },
      ],
    );
  }

  return (
    <Screen testID="screen-profile" showSyncStatus>
      <Text variant="title2">Account</Text>

      <GuestModeBanner mode={mode} />

      <LimitNotice usage={usage} trialCopy={trialCopy} testID="profile-limit-notice" />

      <View style={styles.section}>
        <Text variant="headline">Portability</Text>
        <Text variant="body" tone="secondary">
          Export recipes and tags as JSON anytime. Saved recipes stay viewable
          and exportable after a free-tier limit or downgrade.
        </Text>
        <Button
          label="Export recipes"
          variant="secondary"
          loading={exporting}
          onPress={() => void handleExport()}
          testID="profile-export"
        />
        {trashCount > 0 ? (
          <Button
            label={`Restore trash (${trashCount})`}
            variant="tertiary"
            onPress={handleRestoreTrash}
            testID="profile-restore-trash"
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text variant="headline">Subscription (preview)</Text>
        <Text variant="body" tone="secondary">
          {trialCopy}
        </Text>
        <Button
          label={
            usage.isDowngraded
              ? 'Simulate free plan (already on)'
              : 'Simulate downgrade'
          }
          variant="tertiary"
          disabled={usage.isDowngraded}
          onPress={() => void setDowngraded(true)}
          testID="profile-simulate-downgrade"
          accessibilityHint="Shows that recipes remain viewable and exportable after downgrade"
        />
      </View>

      <View style={styles.section}>
        <Text variant="headline">Danger zone</Text>
        <Button
          label="Delete account / local data"
          variant="destructive"
          onPress={handleDeleteAccountStub}
          testID="profile-delete-stub"
        />
      </View>

      {message ? (
        <Text variant="caption" tone="secondary" testID="profile-message">
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
});
