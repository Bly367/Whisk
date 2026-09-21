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
import { IAP_PRODUCT_IDS } from '@/features/trust/iapConfig';
import { useSessionStore } from '@/features/trust/sessionStore';
import { useIAP } from '@/features/trust/useIAP';

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

  const unlockCopy = useMemo(() => describeUnlockOffer(unlockPricing), [unlockPricing]);
  const iap = useIAP({ useMockInDev: false });

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

  function handleDeleteAccountStub() {
    Alert.alert(
      'Deletion coming later — export first',
      'Guest mode has no cloud account yet. Account and local-data deletion is not available in this build — nothing will be removed. Export your recipes anytime so you keep a copy.',
      [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Got it',
          onPress: () =>
            setMessage(
              'Deletion is stubbed for now — your library was not changed. Export anytime.',
            ),
        },
      ],
    );
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

  async function handleRealPurchase() {
    setMessage(null);
    const result = await iap.purchase(IAP_PRODUCT_IDS.fullUnlock);
    
    if (result.success) {
      await unlockWithPurchase();
      setMessage(`Unlocked for ${unlockPricing.priceLabel} one time.`);
    } else {
      setMessage(result.message);
    }
  }

  async function handleRestorePurchases() {
    setMessage(null);
    const result = await iap.restore();
    
    if (result.success) {
      if (result.message.includes('No previous')) {
        setMessage('No previous purchases found. Purchase to unlock all features.');
      } else {
        await unlockWithPurchase();
        setMessage('Purchase restored successfully. All features unlocked.');
      }
    } else {
      setMessage(result.message);
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

        {iap.available ? (
          <>
            <Button
              label={
                isUnlocked
                  ? entitlement === 'admin'
                    ? 'Unlocked (admin)'
                    : 'Unlocked (purchased)'
                  : `Unlock now (${iap.price || unlockPricing.priceLabel})`
              }
              variant="primary"
              disabled={isUnlocked}
              loading={iap.purchasing}
              onPress={() => void handleRealPurchase()}
              testID="profile-unlock-button"
            />
            <Button
              label="Restore purchases"
              variant="secondary"
              disabled={isUnlocked}
              loading={iap.restoring}
              onPress={() => void handleRestorePurchases()}
              testID="profile-restore-button"
            />
          </>
        ) : (
          <Text variant="body" tone="secondary" testID="profile-iap-unavailable">
            {iap.loading
              ? 'Loading store...'
              : 'In-app purchases require a development build or production app. Running in Expo Go or web?'}
          </Text>
        )}
        {__DEV__ ? (
          <>
            <Button
              label={
                isUnlocked
                  ? entitlement === 'admin'
                    ? 'Unlocked (admin)'
                    : 'Unlocked (purchased)'
                  : `[DEV] Simulate unlock (${unlockPricing.priceLabel})`
              }
              variant="tertiary"
              disabled={isUnlocked}
              onPress={() => {
                void unlockWithPurchase().then(() =>
                  setMessage(`[DEV] Simulated unlock for ${unlockPricing.priceLabel}.`),
                );
              }}
              testID="profile-simulate-unlock"
            />
            <Button
              label={
                entitlement === 'admin'
                  ? 'Admin unlock stays active'
                  : usage.isDowngraded && entitlement === 'free'
                    ? '[DEV] Simulate free plan (already on)'
                    : '[DEV] Simulate free plan'
              }
              variant="tertiary"
              disabled={entitlement === 'admin' || (usage.isDowngraded && entitlement === 'free')}
              onPress={() => void clearPaidUnlock()}
              testID="profile-simulate-downgrade"
              accessibilityHint="[DEV] Shows that recipes remain viewable and exportable after returning to the free plan"
            />
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text variant="headline">Danger zone</Text>
        <Button
          label="Account deletion (coming later)"
          variant="secondary"
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
