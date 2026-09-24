import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, BackHandler, Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { color, radius, shadow } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

/**
 * App-wide dialog, replacing the stock Alert.alert popup. Call alertDialog()
 * (same signature as Alert.alert) or showDialog() from anywhere; <DialogHost />
 * lives once at the root. Layout follows the centered confirmation cards in
 * Affirm / Fabric / Grab: tinted icon, bold title, muted message, then stacked
 * full-width pill buttons with the cancel action last and quietest.
 *
 * It's an overlay, not an RN <Modal>: presenting a Modal while another one is
 * mounting or dismissing is unreliable on iOS. The trade-off is that it can't
 * appear above an open RN Modal, so screens inside one show errors inline.
 */

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type DialogTone = 'info' | 'success' | 'warning' | 'danger';

export type DialogOptions = {
  title: string;
  message?: string;
  buttons?: DialogButton[];
  tone?: DialogTone;
};

type Listener = (d: DialogOptions) => void;
let listener: Listener | null = null;
// Calls made before the host mounts (e.g. the cold-start pending-payment
// prompt) are held here and flushed when it does.
const early: DialogOptions[] = [];

export function showDialog(options: DialogOptions) {
  if (listener) listener(options);
  else early.push(options);
}

const WARNING_TITLE = /error|fail|couldn|could not|weak|missing|expired|do not match|enter your/i;
const SUCCESS_TITLE = /success|updated|submitted|sent|created|welcome/i;

function inferTone(title: string, buttons: DialogButton[]): DialogTone {
  if (buttons.some((b) => b.style === 'destructive')) return 'danger';
  if (WARNING_TITLE.test(title)) return 'warning';
  if (SUCCESS_TITLE.test(title)) return 'success';
  return 'info';
}

/** Drop-in for Alert.alert(title, message?, buttons?). */
export function alertDialog(title: string, message?: string, buttons?: DialogButton[], tone?: DialogTone) {
  const btns = buttons?.length ? buttons : [{ text: 'OK' }];
  showDialog({ title, message, buttons: btns, tone: tone ?? inferTone(title, btns) });
}

const TONES: Record<DialogTone, { icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string }> = {
  info: { icon: 'information', fg: color.accent, bg: color.accentSoft },
  success: { icon: 'checkmark', fg: color.success, bg: '#dcfce7' },
  warning: { icon: 'alert', fg: '#b45309', bg: '#fef3c7' },
  danger: { icon: 'alert', fg: color.danger, bg: '#fee2e2' },
};

export function DialogHost() {
  const [queue, setQueue] = useState<DialogOptions[]>([]);
  const current = queue[0];

  useEffect(() => {
    listener = (d) => setQueue((q) => [...q, d]);
    if (early.length) setQueue((q) => [...q, ...early.splice(0)]);
    return () => {
      listener = null;
    };
  }, []);

  const close = useCallback((button?: DialogButton) => {
    setQueue((q) => q.slice(1));
    button?.onPress?.();
  }, []);

  const cancelButton = current?.buttons?.find((b) => b.style === 'cancel');

  useEffect(() => {
    if (!current) return;
    AccessibilityInfo.announceForAccessibility(current.message ? `${current.title}. ${current.message}` : current.title);
    // Android back = the cancel action if there is one, otherwise just dismiss.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close(cancelButton);
      return true;
    });
    return () => sub.remove();
  }, [current, cancelButton, close]);

  if (!current) return null;

  const tone = TONES[current.tone ?? 'info'];
  const buttons = current.buttons ?? [{ text: 'OK' }];
  const cancel = buttons.find((b) => b.style === 'cancel');
  const actions = buttons.filter((b) => b !== cancel);

  return (
    <Animated.View
      key={queue.length + current.title}
      entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        elevation: 1000,
        backgroundColor: 'rgba(20,20,20,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
    >
      {/* Tapping the scrim is the cancel action, never a destructive one. */}
      <Pressable
        accessible={false}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={() => close(cancel)}
      />
      <Animated.View
        entering={ZoomIn.duration(200).reduceMotion(ReduceMotion.System)}
        accessibilityViewIsModal
        accessibilityRole={Platform.OS === 'android' ? undefined : 'alert'}
        style={{
          width: '100%',
          maxWidth: 360,
          backgroundColor: color.surface,
          borderRadius: radius['2xl'],
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 16,
          alignItems: 'center',
          ...shadow.card,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: tone.bg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <Ionicons name={tone.icon} size={26} color={tone.fg} />
        </View>
        <Text variant="title" style={{ textAlign: 'center' }}>
          {current.title}
        </Text>
        {!!current.message && (
          <Text variant="bodyLg" tone="body" style={{ textAlign: 'center', marginTop: 8 }}>
            {current.message}
          </Text>
        )}
        <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 20 }}>
          {actions.map((b, i) => {
            const destructive = b.style === 'destructive';
            const filled = i === 0;
            return (
              <DialogButtonView
                key={`${b.text}-${i}`}
                text={b.text}
                bg={filled ? (destructive ? color.danger : color.accent) : 'transparent'}
                fg={filled ? color.onAccent : destructive ? color.danger : color.ink}
                border={filled ? undefined : color.border}
                onPress={() => close(b)}
              />
            );
          })}
          {cancel && (
            <DialogButtonView
              text={cancel.text}
              bg={color.surfaceMuted}
              fg={color.inkBody}
              onPress={() => close(cancel)}
            />
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function DialogButtonView({
  text,
  bg,
  fg,
  border,
  onPress,
}: {
  text: string;
  bg: string;
  fg: string;
  border?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scale={0.98}
      onPress={onPress}
      accessibilityRole="button"
      style={{
        height: 50,
        borderRadius: radius.full,
        backgroundColor: bg,
        borderWidth: border ? 1.5 : 0,
        borderColor: border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      }}
    >
      <Text variant="button" numberOfLines={1} style={{ color: fg }}>
        {text}
      </Text>
    </PressableScale>
  );
}
