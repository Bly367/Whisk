import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import {
  createDefaultCookTimerCompletionCuePorts,
  fireCookTimerCompletionCues,
} from '@/features/cook/cookTimerCompletionCue';
import {
  collectTimersNeedingAudibleCue,
  formatTimerRemaining,
  type CookTimer,
} from '@/features/cook/cookTimers';
import { useCookTimerSession } from '@/features/cook/cookTimerSession';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

const PRESETS_SEC = [60, 180, 300, 600] as const;
const defaultCompletionCues = createDefaultCookTimerCompletionCuePorts();

type Props = {
  recipeId: string;
};

/**
 * Multi-timer strip for cook mode. Completion uses visual banner + live region +
 * one-shot audible/haptic (expo-audio ding + Vibration) on rising completionSignaled.
 * Pause/resume helpers exist on the session store; UI keeps add/dismiss for large-target hands-free.
 */
export function CookTimersPanel({ recipeId }: Props) {
  const { colors } = useTheme();
  const beginSession = useCookTimerSession((s) => s.beginSession);
  const timers = useCookTimerSession((s) => s.timers);
  const addTimer = useCookTimerSession((s) => s.addTimer);
  const removeTimer = useCookTimerSession((s) => s.removeTimer);
  const tick = useCookTimerSession((s) => s.tick);
  const acknowledgeCompletion = useCookTimerSession((s) => s.acknowledgeCompletion);
  const [customMinutes, setCustomMinutes] = useState('5');
  const previousTimersRef = useRef<CookTimer[]>([]);

  useEffect(() => {
    beginSession(recipeId);
  }, [beginSession, recipeId]);

  useEffect(() => {
    const id = setInterval(() => tick(Date.now()), 250);
    return () => clearInterval(id);
  }, [tick]);

  useEffect(() => {
    const newly = collectTimersNeedingAudibleCue(previousTimersRef.current, timers);
    previousTimersRef.current = timers;
    if (newly.length === 0) return;
    void fireCookTimerCompletionCues(
      newly.map((t) => t.id),
      defaultCompletionCues,
    );
  }, [timers]);

  const signaling = useMemo(
    () => timers.filter((t) => t.completionSignaled),
    [timers],
  );

  return (
    <View style={styles.root} testID="cook-timers-panel">
      {signaling.length > 0 ? (
        <View
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={[
            styles.alert,
            { backgroundColor: colors.brand.yolkSoft, borderColor: colors.success },
          ]}
          testID="cook-timer-complete-alert"
        >
          <Text variant="headline" style={{ color: colors.success }}>
            {signaling.map((t) => t.label).join(', ')} done
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss timer alert"
            hitSlop={hitSlop}
            onPress={() => signaling.forEach((t) => acknowledgeCompletion(t.id))}
            testID="cook-timer-dismiss"
            style={({ pressed }) =>
              ensureMinTouchTarget({
                ...styles.dismiss,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                opacity: pressed ? 0.85 : 1,
              })
            }
          >
            <Text variant="callout">Got it</Text>
          </Pressable>
        </View>
      ) : null}

      <Text variant="caption" tone="secondary">
        Timers
      </Text>

      <View style={styles.presets}>
        {PRESETS_SEC.map((sec) => (
          <Pressable
            key={sec}
            accessibilityRole="button"
            accessibilityLabel={`Add ${sec / 60} minute timer`}
            hitSlop={hitSlop}
            testID={`cook-timer-preset-${sec}`}
            onPress={() =>
              addTimer({
                label: sec >= 60 ? `${sec / 60} min` : `${sec}s`,
                durationMs: sec * 1000,
              })
            }
            style={({ pressed }) =>
              ensureMinTouchTarget({
                ...styles.presetBtn,
                backgroundColor: colors.brand.yolk,
                opacity: pressed ? 0.85 : 1,
              })
            }
          >
            <Text variant="callout" style={{ color: colors.textOnYolk }}>{sec / 60}m</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.customRow}>
        <TextInput
          accessibilityLabel="Custom timer minutes"
          keyboardType="number-pad"
          value={customMinutes}
          onChangeText={setCustomMinutes}
          testID="cook-timer-custom-input"
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add custom timer"
          hitSlop={hitSlop}
          testID="cook-timer-add-custom"
          onPress={() => {
            const minutes = Number(customMinutes);
            if (!Number.isFinite(minutes) || minutes <= 0) return;
            addTimer({
              label: `${minutes} min`,
              durationMs: Math.round(minutes * 60_000),
            });
          }}
          style={({ pressed }) =>
            ensureMinTouchTarget({
              ...styles.addBtn,
              backgroundColor: colors.brand.yolk,
              opacity: pressed ? 0.9 : 1,
            })
          }
        >
          <Text variant="callout" style={{ color: colors.textOnYolk }}>
            Add
          </Text>
        </Pressable>
      </View>

      {timers.length === 0 ? (
        <Text variant="caption" tone="secondary" testID="cook-timers-empty">
          Add concurrent timers — they keep running while you change steps.
        </Text>
      ) : (
        <View style={styles.list} testID="cook-timers-list">
          {timers.map((timer) => (
            <View
              key={timer.id}
              style={[
                styles.row,
                {
                  backgroundColor: timer.status === 'completed' ? colors.brand.yolkSoft : colors.card,
                  borderColor: colors.border,
                },
              ]}
              testID={`cook-timer-row-${timer.id}`}
            >
              <View style={styles.rowText}>
                <Text variant="headline">{timer.label}</Text>
                <Text
                  variant="title2"
                  accessibilityLabel={`${timer.label} ${formatTimerRemaining(timer.remainingMs)} remaining`}
                  testID={`cook-timer-remaining-${timer.id}`}
                >
                  {timer.status === 'completed'
                    ? 'Done'
                    : formatTimerRemaining(timer.remainingMs)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${timer.label} timer`}
                hitSlop={hitSlop}
                onPress={() => removeTimer(timer.id)}
                testID={`cook-timer-remove-${timer.id}`}
                style={({ pressed }) =>
                  ensureMinTouchTarget({
                    ...styles.removeBtn,
                    opacity: pressed ? 0.7 : 1,
                  })
                }
              >
                <Text variant="callout" tone="secondary">
                  Remove
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  alert: {
    borderRadius: radius.control,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dismiss: {
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetBtn: {
    minHeight: 52,
    minWidth: 60,
    paddingHorizontal: spacing.lg,
    borderRadius: 26,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  addBtn: {
    minHeight: 48,
    minWidth: 72,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  removeBtn: {
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
