import { Platform, type ViewStyle } from 'react-native';

import { touchTarget } from '@/constants/tokens';

export const minTouchSize =
  Platform.OS === 'ios' ? touchTarget.ios : touchTarget.min;

/** Style helpers for interactive controls that meet platform touch guidance. */
export const hitSlop = {
  top: 8,
  bottom: 8,
  left: 8,
  right: 8,
} as const;

export function ensureMinTouchTarget(style?: ViewStyle): ViewStyle {
  return {
    minWidth: minTouchSize,
    minHeight: minTouchSize,
    ...style,
  };
}
