import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  runOnJS,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import { color } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Choreographed brand splash — the logo assembles itself:
 *   1. the bag drops in and lands with a squash-and-settle
 *   2. its speed lines streak in one after another
 *   3. the "L" draws itself on via stroke reveal
 *   4. the wordmark and tagline rise in
 * Then it holds until the app is ready and fades out. Mirrors the native
 * splash (orange ground, white mark) so the handoff reads as one screen.
 * All motion collapses to the finished frame under reduced motion.
 */

const MARK = 170;
const S = MARK / 120; // scale from the logo's 120 viewBox
const L_STROKE_LENGTH = 40;

const RM = ReduceMotion.System;

function StreakInLine({
  width,
  top,
  delay,
  lineColor,
}: {
  width: number;
  top: number;
  delay: number;
  lineColor: string;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(delay, withSpring(1, { damping: 16, stiffness: 190, reduceMotion: RM }));
  }, [delay, p]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.35, 1], [0, 1, 1]),
    transform: [{ translateX: interpolate(p.value, [0, 1], [34, 0]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top,
          width,
          height: 5 * S,
          borderRadius: 2.5 * S,
          backgroundColor: lineColor,
        },
        style,
      ]}
    />
  );
}

function AssemblingMark() {
  const bagDrop = useSharedValue(0); // 0 = above frame, 1 = landed
  const squash = useSharedValue(0); // 0 = rest, 1 = full squash
  const lOffset = useSharedValue(L_STROKE_LENGTH);

  useEffect(() => {
    bagDrop.value = withDelay(80, withSpring(1, { damping: 13, stiffness: 150, reduceMotion: RM }));
    squash.value = withDelay(
      300,
      withSequence(
        withTiming(1, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: RM }),
        withSpring(0, { damping: 9, stiffness: 210, reduceMotion: RM })
      )
    );
    lOffset.value = withDelay(
      680,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: RM })
    );
  }, [bagDrop, squash, lOffset]);

  const bagStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bagDrop.value, [0, 0.25, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(bagDrop.value, [0, 1], [-110, 0]) },
      // squash-and-settle on landing; slight downward shift fakes a
      // bottom-anchored squash (RN scales from center)
      { translateY: interpolate(squash.value, [0, 1], [0, 5]) },
      { scaleX: interpolate(squash.value, [0, 1], [1, 1.07]) },
      { scaleY: interpolate(squash.value, [0, 1], [1, 0.9]) },
    ],
  }));

  const lProps = useAnimatedProps(() => ({ strokeDashoffset: lOffset.value }));

  return (
    <View style={{ width: MARK, height: MARK }}>
      {/* speed lines streak in behind the bag, staggered */}
      <StreakInLine width={26 * S} top={49 * S} delay={380} lineColor="#ffffff" />
      <StreakInLine width={24 * S} top={59.5 * S} delay={500} lineColor={color.ink} />
      <StreakInLine width={17 * S} top={70 * S} delay={620} lineColor="#ffffff" />

      {/* the bag drops in; the L draws itself once landed */}
      <Animated.View style={[{ position: 'absolute', inset: 0 }, bagStyle]}>
        <Svg width={MARK} height={MARK} viewBox="0 0 120 120" fill="none">
          <Path
            d="M 59 43 v -5.5 a 8 8 0 0 1 16 0 v 5.5"
            stroke="#ffffff"
            strokeWidth={3.6}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 53 42 L 81 42 Q 87 42 88.2 47.5 L 95 81.5 Q 96.6 90 87.5 90 L 46.5 90 Q 37.4 90 39 81.5 L 45.8 47.5 Q 47 42 53 42 Z"
            fill="#ffffff"
          />
          <AnimatedPath
            d="M 69.5 52.5 L 63.5 77.5 L 77 77.5"
            stroke={color.ink}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={L_STROKE_LENGTH}
            animatedProps={lProps}
          />
          <Ellipse cx={52.5} cy={98.5} rx={4.8} ry={7} transform="rotate(16 52.5 98.5)" fill="#ffffff" />
          <Ellipse cx={80} cy={98.5} rx={4.8} ry={7} transform="rotate(-5 80 98.5)" fill="#ffffff" />
        </Svg>
      </Animated.View>
    </View>
  );
}

function RiseIn({ delay, children }: { delay: number; children: React.ReactNode }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic), reduceMotion: RM })
    );
  }, [delay, p]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: interpolate(p.value, [0, 1], [14, 0]) }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function BrandSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const opacity = useSharedValue(1);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease), reduceMotion: RM }),
      -1,
      false
    );
  }, [shimmer]);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(onHidden)();
      });
    }
  }, [visible, opacity, onHidden]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (shimmer.value * 2 - 1) * 108 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, containerStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.center}>
        <AssemblingMark />

        <RiseIn delay={900}>
          <Text style={styles.wordmark}>
            Litway <Text style={styles.picks}>Picks</Text>
          </Text>
        </RiseIn>

        <RiseIn delay={1050}>
          <Text style={styles.tagline}>Shop Liberia. Pay with MoMo.</Text>
        </RiseIn>

        <RiseIn delay={1200}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
        </RiseIn>
      </View>

      <Text style={styles.footer}>Delivering to all 15 counties</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  wordmark: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  picks: { color: color.ink },
  tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  track: {
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.18)',
    overflow: 'hidden',
    marginTop: 12,
  },
  fill: { width: 54, height: '100%', borderRadius: 999, backgroundColor: '#ffffff' },
  footer: { position: 'absolute', bottom: 44, color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
});
