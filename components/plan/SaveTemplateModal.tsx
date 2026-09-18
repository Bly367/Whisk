import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type SaveTemplateModalProps = {
  visible: boolean;
  defaultName: string;
  selectionCount?: number;
  onClose: () => void;
  onSave: (name: string) => void;
  testID?: string;
};

export function SaveTemplateModal({
  visible,
  defaultName,
  selectionCount,
  onClose,
  onSave,
  testID = 'save-template',
}: SaveTemplateModalProps) {
  const { colors } = useTheme();
  const [name, setName] = useState(defaultName);
  const isSelection = typeof selectionCount === 'number';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
      onShow={() => setName(defaultName)}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
          testID={testID}
        >
          <Text variant="title2">{isSelection ? 'Save selection as template' : 'Save week as template'}</Text>
          <Text variant="caption" tone="secondary">
            {isSelection
              ? `Stores ${selectionCount} meal${selectionCount === 1 ? '' : 's'} with relative day offsets.`
              : 'Reusable layout for another week. Your current plan stays put.'}
          </Text>
          <Field
            label="Template name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Comfort week"
            testID={`${testID}-name`}
          />
          <Button
            label="Save template"
            onPress={() => onSave(name.trim())}
            disabled={!name.trim()}
            testID={`${testID}-confirm`}
          />
          <Button label="Cancel" variant="tertiary" onPress={onClose} testID={`${testID}-cancel`} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
