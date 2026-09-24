import React, { memo, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { color, radius, type } from '@/theme/tokens';
import { PressableScale } from '@/components/ui/PressableScale';
import { useWishlistStore } from '@/store/wishlist';
import { useCartStore } from '@/store/cart';
import { flyToCart } from '@/components/motion/FlyToCart';
import { showToast } from '@/components/ui/Toast';
import { openQuickAdd } from '@/components/shop/QuickAddSheet';
import { formatCurrency, discountPercent } from '@/lib/currency';
import type { Product } from '@/types';
import { Text } from '@/components/ui/Text';

interface Props {
  product: Product;
  width?: number;
  variant?: 'grid' | 'horizontal';
}

export const ProductCard = memo(function ProductCard({ product, width, variant = 'grid' }: Props) {
  const router = useRouter();
  const toggle = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.isWishlisted(product.id ?? ''));

  const addItem = useCartStore((s) => s.addItem);
  // Units of this product already in the cart, across every size/colour line.
  const inCart = useCartStore((s) =>
    s.items.reduce((n, i) => (i.productId === product.id ? n + i.quantity : n), 0)
  );
  const [justAdded, setJustAdded] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const imageUrl = product.image_urls?.[0] ?? null;
  const hasDiscount = product.sale_price != null && product.sale_price < (product.price ?? 0);
  const discount = hasDiscount ? discountPercent(product.price!, product.sale_price!) : 0;
  const displayPrice = product.sale_price ?? product.price ?? 0;
  const inStock = (product.stock ?? 0) > 0;
  const rating = product.rating ?? 0;
  const reviewCount = product.review_count ?? 0;

  const isHorizontal = variant === 'horizontal';

  // The + always adds without leaving the list. A product with a real choice
  // (several sizes or colours) opens the quick-select sheet first; otherwise it
  // goes straight in with its only option.
  const sizes = product.sizes ?? [];
  const colors = product.colors ?? [];
  const needsChoice = sizes.length > 1 || colors.length > 1;
  const atStockLimit = inCart >= (product.stock ?? 0);

  function handleQuickAdd(e: GestureResponderEvent) {
    if (atStockLimit) {
      showToast({
        title: 'Already in your cart',
        detail: `All ${product.stock} available units of ${product.name} are in your cart`,
        tone: 'info',
        action: { label: 'View cart', href: '/(tabs)/cart' },
      });
      return;
    }
    if (needsChoice) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openQuickAdd(product);
      return;
    }
    flyToCart(e.nativeEvent.pageX, e.nativeEvent.pageY);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem({
      productId: product.id ?? '',
      name: product.name ?? '',
      brand: product.brand ?? '',
      price: displayPrice,
      listPrice: hasDiscount ? product.price ?? undefined : undefined,
      imageUrl: imageUrl ?? '',
      slug: product.slug ?? '',
      stock: product.stock ?? 0,
      size: sizes[0],
      color: colors[0],
    });
    const variant = [sizes[0], colors[0]].filter(Boolean).join(' · ');
    showToast({
      title: 'Added to cart',
      detail: variant ? `${product.name} · ${variant}` : product.name ?? undefined,
      imageUrl,
      action: { label: 'View cart', href: '/(tabs)/cart' },
    });
    setJustAdded(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setJustAdded(false), 1400);
  }

  function handleWishlist() {
    toggle({
      productId: product.id ?? '',
      name: product.name ?? '',
      brand: product.brand ?? '',
      price: product.price ?? 0,
      salePrice: product.sale_price ?? undefined,
      imageUrl: imageUrl ?? '',
      slug: product.slug ?? '',
      stock: product.stock ?? 0,
      categorySlug: product.category_slug ?? undefined,
      categoryName: product.category_name ?? undefined,
    });
  }

  const imageHeight = isHorizontal ? 185 : 200;

  return (
    <PressableScale
      haptic
      scale={0.97}
      onPress={() => router.push(`/product/${product.slug}`)}
      style={{
        width: width ?? (isHorizontal ? 172 : undefined),
        alignSelf: width || isHorizontal ? 'auto' : 'stretch',
      }}
    >
      {/* Image — the card IS the image now, no enclosing box */}
      <Animated.View
        sharedTransitionTag={`product-image-${product.id}`}
        style={{ position: 'relative', height: imageHeight, borderRadius: radius.lg, overflow: 'hidden' }}
      >
        <Image
          source={{ uri: imageUrl ?? undefined }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          recyclingKey={product.id}
        />

        {hasDiscount && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: color.accent,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: radius.sm,
            }}
          >
            <Text variant="label" tone="onAccent">
              -{discount}%
            </Text>
          </View>
        )}

        {!inStock && (
          <View
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <View style={{ backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text variant="label" style={{ color: '#fff' }}>SOLD OUT</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={handleWishlist}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          accessibilityState={{ selected: isWishlisted }}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.95)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={15}
            color={isWishlisted ? '#ef4444' : color.inkMuted}
          />
        </TouchableOpacity>

        {/* Quick add — bottom-right of the image, clear of the wishlist heart */}
        {inStock && (
          <TouchableOpacity
            onPress={handleQuickAdd}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={needsChoice ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
            style={{
              position: 'absolute', bottom: 8, right: 8,
              minWidth: 36, height: 36, borderRadius: 18,
              paddingHorizontal: 6,
              backgroundColor: justAdded ? color.success : inCart > 0 ? color.accent : 'rgba(255,255,255,0.97)',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
              elevation: 3,
              opacity: atStockLimit && !justAdded ? 0.6 : 1,
            }}
          >
            {justAdded ? (
              <Ionicons name="checkmark" size={20} color="#fff" />
            ) : inCart > 0 ? (
              <Text variant="bodyStrong" style={{ color: '#fff' }}>{inCart}</Text>
            ) : (
              <Ionicons name="add" size={22} color={color.ink} />
            )}
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Caption — sits directly on the grey canvas, no card box */}
      <View style={{ paddingTop: 8, paddingHorizontal: 2 }}>
        <Text variant="overline" tone="muted" numberOfLines={1} style={{ marginBottom: 3 }}>
          {product.brand ?? '—'}
        </Text>
        <Text variant="small" numberOfLines={2} style={{ marginBottom: 4 }}>
          {product.name}
        </Text>
        {rating > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <Ionicons name="star" size={12} color={color.star} />
            <Text variant="label" tone="muted" style={{ marginLeft: 4 }}>
              {rating.toFixed(1)}
              {reviewCount > 0 ? ` · ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : ''}
            </Text>
          </View>
        )}
        <Text variant="price" tone="accent">
          {formatCurrency(displayPrice)}
          {hasDiscount && (
            <Text variant="meta" tone="faint" style={{ textDecorationLine: 'line-through' }}>
              {'  '}{formatCurrency(product.price!)}
            </Text>
          )}
        </Text>
      </View>
    </PressableScale>
  );
});
