import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

interface FolderPillProps {
  emoji: string;
  name: string;
  color: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
}

export function FolderPill({ emoji, name, color, count, selected, onPress }: FolderPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && { backgroundColor: `${color}22`, borderColor: color },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.name, selected && { color }]}>{name}</Text>
      {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  emoji: {
    fontSize: 16,
  },
  name: {
    ...typography.caption,
    color: colors.text,
  },
  count: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
