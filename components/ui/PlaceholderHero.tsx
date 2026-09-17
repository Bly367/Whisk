import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type PlaceholderScreenProps = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
};

export function PlaceholderHero({
  title,
  body,
  actionLabel,
  onAction,
  actionTestID,
}: PlaceholderScreenProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.accent,
          { backgroundColor: colors.brand.yolkSoft, borderColor: colors.border },
        ]}
      />
      <Text variant="title1">{title}</Text>
      <Text variant="body" tone="secondary">
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          testID={actionTestID}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  accent: {
    width: 40,
    height: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});
