import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'url';
  testID?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  testID,
  autoCapitalize = 'sentences',
}: FieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text variant="callout">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        testID={testID}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            backgroundColor: colors.sunken,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    lineHeight: 24,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
