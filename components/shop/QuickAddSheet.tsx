import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, ScrollView, TouchableOpacity, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius } from '@/theme/tokens';
import { useCartStore } from '@/store/cart';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { flyToCart } from '@/components/motion/FlyToCart';
import { showToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/currency';
import type { Product } from '@/types';
import { Text } from '@/components/ui/Text';

/**
 * Quick-add sheet for products that need a size and/or colour: opened from the
 * + on a product card so the shopper can choose without leaving the list.
 * One instance lives at the root (like the toast); call openQuickAdd(product).
 */

let opener: ((p: Product) => void) | null = null;

export function openQuickAdd(product: Product) {
  opener?.(product);
}

const OFFSCREEN = 700;

export function QuickAddSheetHost() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState<Product | null>(null);
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [colorChoice, setColorChoice] = useState<string | null>(null);
  const [missing, setMissing] = useState<'size' | 'color' | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const translateY = useSharedValue(OFFSCREEN);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    opener = (p) => {
      const sizes = p.sizes ?? [];
      const colors = p.colors ?? [];
      setProduct(p);
      // A lone option isn't a choice — preselect it.
      setSize(sizes.length === 1 ? sizes[0] : null);
      setColorChoice(colors.length === 1 ? colors[0] : null);
      setMissing(null);
      setMounted(true);
      backdrop.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    };
    return () => { opener = null; };
  }, [backdrop, translateY]);

  const finishClose = useCallback(() => setMounted(false), []);
  const close = useCallback(() => {
    backdrop.value = withTiming(0, { duration: 160 });
    translateY.value = withTiming(OFFSCREEN, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(finishClose)();
    });
  }, [backdrop, translateY, finishClose]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted || !product) return null;

  const sizes = product.sizes ?? [];
  const colors = product.colors ?? [];
  const hasDiscount = product.sale_price != null && product.sale_price < (product.price ?? 0);
  const price = product.sale_price ?? product.price ?? 0;
  const imageUrl = product.image_urls?.[0] ?? null;
  const needsSize = sizes.length > 0 && !size;
  const needsColor = colors.length > 0 && !colorChoice;
  const label = needsSize ? 'Select a size' : needsColor ? 'Select a color' : 'Add to cart';

  function handleAdd(e: GestureResponderEvent) {
    if (!product) return;
    if (needsSize || needsColor) {
      setMissing(needsSize ? 'size' : 'color');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    flyToCart(e.nativeEvent.pageX, e.nativeEvent.pageY);
    addItem({
      productId: product.id ?? '',
      name: product.name ?? '',
      brand: product.brand ?? '',
      price,
      listPrice: hasDiscount ? product.price ?? undefined : undefined,
      imageUrl: imageUrl ?? '',
      slug: product.slug ?? '',
      stock: product.stock ?? 0,
      size: size ?? undefined,
      color: colorChoice ?? undefined,
    });
    showToast({
      title: 'Added to cart',
      detail: `${product.name} · ${[size, colorChoice].filter(Boolean).join(' · ')}`,
      imageUrl,
      action: { label: 'View cart', href: '/(tabs)/cart' },
    });
    close();
  }

  function chip(active: boolean, missingNow: boolean) {
    return {
      minWidth: 52,
      height: 44,
      paddingHorizontal: 16,
      borderRadius: radius.full,
      borderWidth: 2,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: active ? color.ink : color.surface,
      borderColor: active ? color.ink : missingNow ? color.danger : color.border,
    };
  }

  function section(
    title: string,
    options: string[],
    selected: string | null,
    onSelect: (v: string) => void,
    key: 'size' | 'color',
  ) {
    const isMissing = missing === key && !selected;
    return (
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Text variant="button">
            {title}{selected ? <Text tone="accent">  {selected}</Text> : ''}
          </Text>
          {!selected && (
            <Text variant="metaStrong" style={{ color: isMissing ? color.danger : color.accentPressed }}>
              {isMissing ? `Select a ${title.toLowerCase()} to continue` : 'Required'}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((o) => (
            <PressableScale
              key={o}
              haptic
              onPress={() => { onSelect(o); setMissing(null); }}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === o }}
              style={chip(selected === o, isMissing)}
            >
              <Text variant="bodyStrong" style={{ color: selected === o ? color.onInk : color.ink }}>{o}</Text>
            </PressableScale>
          ))}
        </View>
      </View>
    );
  }

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, backdropStyle]}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={close} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute', left: 0, right: 0, bottom: 0,
            backgroundColor: color.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: '85%',
            paddingBottom: Math.max(insets.bottom, 16),
          },
          sheetStyle,
        ]}
      >
        {/* Product summary */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: color.border }}>
          <Image source={{ uri: imageUrl ?? undefined }} style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: color.surfaceSunken }} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text variant="button" numberOfLines={2}>{product.name}</Text>
            <Text variant="heading" tone="accent" style={{ marginTop: 4 }}>
              {formatCurrency(price)}
              {hasDiscount && (
                <Text variant="caption" tone="body" style={{ textDecorationLine: 'line-through' }}>
                  {'  '}{formatCurrency(product.price!)}
                </Text>
              )}
            </Text>
          </View>
          <TouchableOpacity
            onPress={close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <Ionicons name="close" size={20} color={color.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} bounces={false} contentContainerStyle={{ padding: 20, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {sizes.length > 0 && section('Size', sizes, size, setSize, 'size')}
          {colors.length > 0 && section('Color', colors, colorChoice, setColorChoice, 'color')}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 4 }}>
          <Button title={label} onPress={handleAdd} variant="primary" size="lg" fullWidth />
          <TouchableOpacity
            onPress={() => {
              const slug = product.slug;
              close();
              router.push(`/product/${slug}`);
            }}
            hitSlop={8}
            accessibilityRole="button"
            style={{ alignSelf: 'center', paddingVertical: 10 }}
          >
            <Text variant="bodyStrong" tone="accent">View full details</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}
