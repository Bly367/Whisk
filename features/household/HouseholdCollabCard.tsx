import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { createHouseholdCollaboration, getRepositories, type HouseholdWithMembers } from '@/data';
import { spacing } from '@/constants/tokens';
import { useAuthSessionStore } from '@/data/sync/authSession';

type Props = {
  testID?: string;
};

/**
 * Lightweight invite / join surface for P2-W3.
 * Grocery realtime applies in the Shop path; this card owns membership UX only.
 */
export function HouseholdCollabCard({ testID = 'household-collab' }: Props) {
  const identity = useAuthSessionStore((s) => s.identity);
  const mode = useAuthSessionStore((s) => s.mode);
  const [household, setHousehold] = useState<HouseholdWithMembers | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const userId = identity?.user.id ?? null;
  const displayName = identity?.user.displayName ?? identity?.user.email ?? null;

  const refresh = useCallback(() => {
    try {
      const { households } = getRepositories();
      const listed = households.list();
      if (listed.length === 0) {
        setHousehold(null);
        return;
      }
      setHousehold(households.getById(listed[0]!.id));
    } catch {
      setHousehold(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requireSignedIn = (): boolean => {
    if (mode !== 'signed_in' || !userId) {
      setMessage('Sign in to create or join a household. Guest shopping still works offline.');
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!requireSignedIn() || !userId) return;
    setBusy(true);
    setMessage(null);
    try {
      const collab = createHouseholdCollaboration(getRepositories());
      const created = collab.createHousehold({
        name: 'Our Kitchen',
        ownerUserId: userId,
        ownerDisplayName: displayName,
      });
      setHousehold(created);
      setMessage(`Household ready. Share invite code ${created.inviteCode}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create household.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = () => {
    if (!requireSignedIn() || !userId) return;
    setBusy(true);
    setMessage(null);
    try {
      const collab = createHouseholdCollaboration(getRepositories());
      const joined = collab.joinByInviteCode({
        inviteCode: joinCode,
        userId,
        displayName,
      });
      setHousehold(joined.household);
      setJoinCode('');
      setMessage(`Joined ${joined.household.name}. Shared grocery updates will appear on Shop.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not join household.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section} testID={testID}>
      <Text variant="headline">Household</Text>
      <Text variant="body" tone="secondary">
        Invite someone with a code so you share one grocery list. Updates sync when you are signed
        in and a member of the household.
      </Text>

      {household ? (
        <View style={styles.card} testID={`${testID}-current`}>
          <Text variant="callout">{household.name}</Text>
          <Text variant="caption" tone="secondary">
            Members: {household.members.filter((m) => m.status === 'active').length}
          </Text>
          {household.inviteCode ? (
            <Text variant="body" testID={`${testID}-invite-code`}>
              Invite code: {household.inviteCode}
            </Text>
          ) : null}
        </View>
      ) : (
        <Button
          label="Create household"
          variant="secondary"
          loading={busy}
          onPress={handleCreate}
          testID={`${testID}-create`}
        />
      )}

      <Field
        label="Join with invite code"
        value={joinCode}
        onChangeText={setJoinCode}
        placeholder="e.g. ABCD1234"
        autoCapitalize="characters"
        testID={`${testID}-join-field`}
      />
      <Button
        label="Join household"
        variant="tertiary"
        loading={busy}
        disabled={!joinCode.trim()}
        onPress={handleJoin}
        testID={`${testID}-join`}
      />

      {message ? (
        <Text variant="caption" tone="secondary" testID={`${testID}-message`}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.xs,
  },
});
