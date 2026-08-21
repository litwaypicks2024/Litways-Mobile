import React, { useState, forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  type TextInputProps,
  type ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius } from '@/theme/tokens';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  /**
   * Styles the outer pill container (e.g. tinting a read-only field grey).
   * `style` only reaches the inner TextInput, which would leave the pill white
   * around a square-cornered tinted text area.
   */
  containerStyle?: ViewStyle;
  /**
   * Gives the pill a visible resting border so an editable field reads as
   * editable even before it's focused. Default (false) keeps the border
   * transparent at rest, matching every existing screen's look.
   */
  outlined?: boolean;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, leftIcon, rightIcon, onRightIconPress, isPassword, style, containerStyle, outlined, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderColor = error
    ? color.danger
    : focused
    ? color.accent
    : outlined
    ? color.border
    : 'transparent';

  return (
    <View style={{ marginBottom: 16 }}>
      {label && (
        <Text style={{ fontSize: 13, fontWeight: '600', color: color.inkMuted, marginBottom: 6 }}>{label}</Text>
      )}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: color.surface,
            borderRadius: radius.full,
            borderWidth: outlined ? 1 : 1.5,
            paddingHorizontal: 16,
            minHeight: 50,
          },
          containerStyle,
          /* Applied last so the focus/error border color is never overridden. */
          { borderColor },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={focused ? color.accent : color.inkFaint}
            style={{ marginRight: 10 }}
          />
        )}
        <TextInput
          ref={ref}
          style={[{ flex: 1, fontSize: 14, color: color.ink, paddingVertical: 12 }, style]}
          placeholderTextColor={color.inkFaint}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: showPassword }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={color.inkFaint}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} hitSlop={8}>
            <Ionicons name={rightIcon} size={18} color={color.inkFaint} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error && (
        <Text style={{ fontSize: 12, color: color.danger, marginTop: 4, marginLeft: 4 }}>{error}</Text>
      )}
    </View>
  );
});
