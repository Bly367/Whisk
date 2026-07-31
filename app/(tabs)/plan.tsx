import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Meal Plan"
        subtitle="Plan your week at a glance."
      />
      <View style={styles.content}>
        <View style={styles.calendar}>
          {days.map((day) => (
            <View key={day} style={styles.dayCol}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={styles.slot}>
                <Text style={styles.slotText}>+ Add meal</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.comingSoon}>
          <Text style={styles.comingTitle}>Coming in v2</Text>
          <Text style={styles.comingBody}>
            Drag recipes onto your weekly calendar, plan breakfast/lunch/dinner, and auto-generate grocery lists.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  calendar: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dayCol: {
    flex: 1,
    gap: spacing.sm,
  },
  dayLabel: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 10,
  },
  slot: {
    height: 100,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  slotText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  comingSoon: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  comingTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  comingBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
});
