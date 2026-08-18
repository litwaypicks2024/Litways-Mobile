import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBlock({ width = '100%', height, borderRadius = 8, style }: SkeletonProps) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 200 }],
  }));

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#e2e2e2',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: -200, right: -200 }, animatedStyle]}>
        <LinearGradient
          colors={['#e2e2e2', '#ececec', '#e2e2e2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

export function ProductCardSkeleton() {
  return (
    <View style={{ width: 172, marginRight: 12 }}>
      <SkeletonBlock height={185} borderRadius={16} />
      <View style={{ paddingTop: 8, gap: 6 }}>
        <SkeletonBlock height={10} width="50%" borderRadius={5} />
        <SkeletonBlock height={13} borderRadius={6} />
        <SkeletonBlock height={16} width="40%" borderRadius={6} />
      </View>
    </View>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: '50%', padding: 6 }}>
          <SkeletonBlock height={190} borderRadius={16} />
          <View style={{ paddingTop: 8, gap: 6 }}>
            <SkeletonBlock height={10} width="45%" borderRadius={5} />
            <SkeletonBlock height={13} borderRadius={6} />
            <SkeletonBlock height={13} width="70%" borderRadius={6} />
            <SkeletonBlock height={16} width="35%" borderRadius={6} style={{ marginTop: 2 }} />
          </View>
        </View>
      ))}
    </>
  );
}
