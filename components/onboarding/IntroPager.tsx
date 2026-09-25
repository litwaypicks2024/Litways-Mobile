import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { LottieScene } from '@/components/onboarding/LottieScene';
import { color, radius, spacing } from '@/theme/tokens';

const SLIDES = [
  {
    source: require('@/assets/lottie/onboarding-shop.json'),
    label: 'A shopping bag filling up with a phone, a shirt, sneakers, a home and a favourite',
    title: 'Everything you need,\nin one app',
    body: 'Fashion, phones, home goods and more, from local sellers you can trust.',
  },
  {
    source: require('@/assets/lottie/onboarding-momo.json'),
    label: 'A phone showing checkout, a payment prompt, a PIN being entered and a green tick',
    title: 'Pay with MTN MoMo,\nno card needed',
    body: "Tap pay, approve the prompt on your phone and you're done. It takes about a minute.",
  },
  {
    source: require('@/assets/lottie/onboarding-delivery.json'),
    label: 'A parcel travelling from a shop along a route to a home, with a delivered tick',
    title: 'Delivered to your door,\nacross Liberia',
    body: 'Follow every order from payment to delivery, in all 15 counties.',
  },
] as const;

interface Props {
  initialIndex?: number;
  /** Finished the slides (or skipped them): on to the next step. */
  onDone: () => void;
  /** "I already have an account" on the last slide. */
  onSignIn: () => void;
}

/**
 * Three-slide intro. The pictures are Lottie stories that play when their slide
 * settles; dots stretch with the scroll, and the copy drifts and fades a little
 * faster than the page so the slides feel layered, not stacked.
 */
export function IntroPager({ initialIndex = 0, onDone, onSignIn }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(initialIndex * width);
  const [index, setIndex] = useState(initialIndex);
  const isLast = index === SLIDES.length - 1;
  const scene = Math.min(width * 0.92, height * 0.44);

  // Coming back from a later step lands on the last slide. contentOffset only works on iOS, so also scroll explicitly.
  useEffect(() => {
    if (initialIndex > 0) requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  function settle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function next() {
    if (isLast) return onDone();
    const to = index + 1;
    setIndex(to);
    scrollRef.current?.scrollTo({ x: to * width, animated: true });
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.surface, paddingTop: insets.top }}>
      <View style={{ height: 48, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing.xl }}>
        {!isLast && (
          <TouchableOpacity onPress={onDone} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip the intro">
            <Text variant="button" tone="muted">Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        contentOffset={{ x: initialIndex * width, y: 0 }}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <Slide key={i} index={i} width={width} scrollX={scrollX} reduced={reduced} scene={scene} active={index === i} slide={s} />
        ))}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.lg }} accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>
        <Button
          title={isLast ? 'Get started' : 'Next'}
          onPress={next}
          fullWidth
          size="lg"
          icon={<Ionicons name="arrow-forward" size={18} color={color.onAccent} />}
        />
        <View style={{ height: 40, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}>
          {isLast && (
            <TouchableOpacity onPress={onSignIn} hitSlop={10} accessibilityRole="button">
              <Text variant="small" tone="muted">Already have an account? <Text variant="small" tone="accent">Sign in</Text></Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function Slide({
  index, width, scrollX, reduced, scene, active, slide,
}: {
  index: number; width: number; scrollX: SharedValue<number>; reduced: boolean; scene: number; active: boolean;
  slide: (typeof SLIDES)[number];
}) {
  const textStyle = useAnimatedStyle(() => {
    const d = scrollX.value - index * width;
    return {
      opacity: interpolate(Math.abs(d), [0, width * 0.55], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: reduced ? 0 : d * 0.3 }],
    };
  });
  const sceneStyle = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.value - index * width);
    return {
      opacity: interpolate(d, [0, width * 0.7], [1, 0.25], Extrapolation.CLAMP),
      transform: [{ scale: reduced ? 1 : interpolate(d, [0, width], [1, 0.9], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={sceneStyle}>
        <LottieScene source={slide.source} active={active} size={scene} label={slide.label} />
      </Animated.View>
      <Animated.View style={[{ paddingHorizontal: spacing.xl, alignItems: 'center', marginTop: spacing.sm }, textStyle]}>
        <Text variant="display" style={{ textAlign: 'center' }}>{slide.title}</Text>
        <Text variant="bodyLg" tone="body" style={{ textAlign: 'center', marginTop: spacing.md, maxWidth: 320 }}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = scrollX.value / width;
    const range = [index - 1, index, index + 1];
    return {
      width: interpolate(p, range, [7, 24, 7], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(p, range, [color.border, color.accentFill, color.border]),
    };
  });
  return <Animated.View style={[{ height: 7, borderRadius: radius.full }, style]} />;
}
