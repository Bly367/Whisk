import { useEffect, useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { GuestModeBanner } from '@/components/trust/GuestModeBanner';
import { LimitNotice } from '@/components/trust/LimitNotice';
import { spacing } from '@/constants/tokens';
import { createOfflineReader, getDatabase, getRepositories } from '@/data';
import { HouseholdCollabCard } from '@/features/household/HouseholdCollabCard';
import { buildExportFromRepos, exportPayloadToJson } from '@/features/trust/exportRecipes';
import { describeUnlockOffer, PAYMENT } from '@/features/trust/freeTier';
import { useSessionStore } from '@/features/trust/sessionStore';
import { deleteAllLocalData } from '@/features/trust/deleteLocalData';

export default function ProfileScreen() {
  const mode = useSessionStore((s) => s.mode);
  const usage = useSessionStore((s) => s.usage);
  const entitlement = useSessionStore((s) => s.entitlement);
  const unlockPricing = useSessionStore((s) => s.unlockPricing);
  const hydrate = useSessionStore((s) => s.hydrate);
  const clearPaidUnlock = useSessionStore((s) => s.clearPaidUnlock);
  const unlockWithPurchase = useSessionStore((s) => s.unlockWithPurchase);
  const applyInfluencerCode = useSessionStore((s) => s.applyInfluencerCode);
  const clearDiscountCode = useSessionStore((s) => s.clearDiscountCode);
  const [exporting, setExporting] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const unlockCopy = useMemo(() => describeUnlockOffer(unlockPricing), [unlockPricing]);

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
      restored === 1 ? 'Restored 1 recipe from trash.' : `Restored ${restored} recipes from trash.`,
    );
  }

  function handleDeleteAccount() {
    const db = getDatabase();
    const reader = createOfflineReader(db);
    const recipeCount = reader.listRecipes({ includeDeleted: false }).length;

    // First confirmation: warn about data loss and encourage export
    Alert.alert(
      'Delete all local data?',
      recipeCount > 0
        ? `This will permanently delete all ${recipeCount} recipe${recipeCount === 1 ? '' : 's'}, plans, grocery lists, and pantry items from this device. This cannot be undone.\n\nWe strongly recommend exporting your recipes first.`
        : 'This will delete all local data from this device. Your library is currently empty.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: recipeCount > 0 ? 'Export first' : 'Delete',
          style: recipeCount > 0 ? 'default' : 'destructive',
          onPress: () => {
            if (recipeCount > 0) {
              // Offer to export first
              void handleExport();
              setMessage('Export your recipes, then return here to delete.');
            } else {
              // No recipes, proceed to second confirmation
              confirmDeletion();
            }
          },
        },
        ...(recipeCount > 0
          ? [
              {
                text: 'Delete anyway',
                style: 'destructive' as const,
                onPress: confirmDeletion,
              },
            ]
          : []),
      ],
    );
  }

  function confirmDeletion() {
    // Second confirmation: final warning
    Alert.alert(
      'Are you absolutely sure?',
      'All your recipes, plans, and data on this device will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => void performDeletion(),
        },
      ],
    );
  }

  async function performDeletion() {
    setDeleting(true);
    setMessage(null);
    try {
      const db = getDatabase();
      await deleteAllLocalData(db);
      setTrashCount(0);
      setMessage('All local data has been deleted. You can start fresh anytime.');
      router.replace('/');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Could not delete data: ${error.message}`
          : 'Could not delete data. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleApplyCode() {
    setApplyingCode(true);
    setMessage(null);
    try {
      const result = await applyInfluencerCode(codeInput);
      setMessage(result.message);
      if (result.ok) {
        setCodeInput('');
      }
    } finally {
      setApplyingCode(false);
    }
  }

  const isUnlocked = entitlement === 'unlocked' || entitlement === 'admin';

  return (
    <Screen testID="screen-profile" showSyncStatus>
      <Text variant="title2">Account</Text>

      <GuestModeBanner mode={mode} />

      <HouseholdCollabCard />

      <LimitNotice
        usage={usage}
        entitlement={entitlement}
        unlockCopy={unlockCopy}
        testID="profile-limit-notice"
      />

      <View style={styles.section}>
        <Text variant="headline">Pantry</Text>
        <Text variant="body" tone="secondary">
          Track staples on this device, then boost or filter Recipes by what you already have —
          coverage is always labeled, never silent.
        </Text>
        <Button
          label="Open pantry"
          variant="secondary"
          onPress={() => router.push('/pantry')}
          testID="profile-open-pantry"
        />
      </View>

      <View style={styles.section}>
        <Text variant="headline">Portability</Text>
        <Text variant="body" tone="secondary">
          Export recipes and tags as JSON anytime. Saved recipes stay viewable and exportable after
          a free-tier limit or downgrade.
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
        <Text variant="headline">Unlock (preview)</Text>
        <Text variant="body" tone="secondary" testID="profile-unlock-copy">
          {unlockCopy}
        </Text>
        {unlockPricing.isDiscounted ? (
          <Text variant="caption" tone="secondary" testID="profile-discount-active">
            Active influencer code: {unlockPricing.influencerCode} → {unlockPricing.priceLabel}{' '}
            (from {PAYMENT.oneTimePriceLabel})
          </Text>
        ) : null}
        {entitlement === 'admin' ? (
          <Text variant="caption" tone="secondary" testID="profile-admin-active">
            Admin unlock active — all features free on this device.
          </Text>
        ) : null}

        <Field
          label="Influencer or admin code"
          value={codeInput}
          onChangeText={setCodeInput}
          placeholder="e.g. WHISK499"
          autoCapitalize="characters"
          testID="profile-code-input"
        />
        <Button
          label="Apply code"
          variant="secondary"
          loading={applyingCode}
          onPress={() => void handleApplyCode()}
          testID="profile-apply-code"
        />
        {unlockPricing.isDiscounted && entitlement !== 'admin' ? (
          <Button
            label="Clear discount code"
            variant="tertiary"
            onPress={() => {
              void clearDiscountCode().then(() =>
                setMessage(`Discount cleared. Unlock is ${PAYMENT.oneTimePriceLabel} one time.`),
              );
            }}
            testID="profile-clear-discount"
          />
        ) : null}

        <Button
          label={
            isUnlocked
              ? entitlement === 'admin'
                ? 'Unlocked (admin)'
                : 'Unlocked (purchased)'
              : `Simulate unlock (${unlockPricing.priceLabel})`
          }
          variant="primary"
          disabled={isUnlocked}
          onPress={() => {
            void unlockWithPurchase().then(() =>
              setMessage(`Unlocked for ${unlockPricing.priceLabel} one time.`),
            );
          }}
          testID="profile-simulate-unlock"
        />
        <Button
          label={
            entitlement === 'admin'
              ? 'Admin unlock stays active'
              : usage.isDowngraded && entitlement === 'free'
                ? 'Simulate free plan (already on)'
                : 'Simulate free plan'
          }
          variant="tertiary"
          disabled={entitlement === 'admin' || (usage.isDowngraded && entitlement === 'free')}
          onPress={() => void clearPaidUnlock()}
          testID="profile-simulate-downgrade"
          accessibilityHint="Shows that recipes remain viewable and exportable after returning to the free plan"
        />
      </View>

      <View style={styles.section}>
        <Text variant="headline">Danger zone</Text>
        <Text variant="body" tone="secondary">
          Guest mode has no cloud account. This deletes all on-device data — recipes, plans,
          grocery lists, and pantry items. Cloud account deletion will be added when cloud sync
          ships.
        </Text>
        <Button
          label="Delete all local data"
          variant="secondary"
          loading={deleting}
          onPress={handleDeleteAccount}
          testID="profile-delete-data"
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
