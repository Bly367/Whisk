import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { typography } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type TextVariant =
  'display' | 'title1' | 'title2' | 'headline' | 'body' | 'callout' | 'caption';

export type TextTone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

const variantStyle: Record<TextVariant, TextStyle> = {
  display: typography.display,
  title1: typography.title1,
  title2: typography.title2,
  headline: typography.headline,
  body: typography.body,
  callout: typography.callout,
  caption: typography.caption,
};

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  const { colors } = useTheme();

  const toneColor =
    tone === 'secondary'
      ? colors.textSecondary
      : tone === 'success'
        ? colors.success
        : tone === 'warning'
          ? colors.warning
          : tone === 'error'
            ? colors.error
            : tone === 'info'
              ? colors.info
              : colors.textPrimary;

  return (
    <RNText
      allowFontScaling
      style={[variantStyle[variant], { color: toneColor }, style]}
      {...rest}
    />
  );
}
