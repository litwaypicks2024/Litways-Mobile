import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { color, font, radius, type } from '@/theme/tokens';
import { PressableScale } from '@/components/ui/PressableScale';
import { useWishlistStore } from '@/store/wishlist';
import { formatCurrency, discountPercent } from '@/lib/currency';
import type { Product } from '@/types';

interface Props {
  product: Product;
  width?: number;
  variant?: 'grid' | 'horizontal';
}

export const ProductCard = memo(function ProductCard({ product, width, variant = 'grid' }: Props) {
  const router = useRouter();
  const toggle = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.isWishlisted(product.id ?? ''));

  const imageUrl = product.image_urls?.[0] ?? null;
  const hasDiscount = product.sale_price != null && product.sale_price < (product.price ?? 0);
  const discount = hasDiscount ? discountPercent(product.price!, product.sale_price!) : 0;
  const displayPrice = product.sale_price ?? product.price ?? 0;
  const inStock = (product.stock ?? 0) > 0;
  const rating = product.rating ?? 0;
  const reviewCount = product.review_count ?? 0;

  const isHorizontal = variant === 'horizontal';

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
            <Text style={{ color: color.onAccent, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
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
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>SOLD OUT</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={handleWishlist}
          hitSlop={8}
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
      </Animated.View>

      {/* Caption — sits directly on the grey canvas, no card box */}
      <View style={{ paddingTop: 8, paddingHorizontal: 2 }}>
        <Text numberOfLines={1} style={{ ...type.overline, marginBottom: 3 }}>
          {product.brand ?? '—'}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: color.ink, lineHeight: 18, marginBottom: 4 }}>
          {product.name}
        </Text>
        {rating > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <Ionicons name="star" size={12} color={color.star} />
            <Text style={{ fontSize: 11, color: color.inkMuted, fontWeight: '600', marginLeft: 4 }}>
              {rating.toFixed(1)}
              {reviewCount > 0 ? ` · ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : ''}
            </Text>
          </View>
        )}
        <Text style={{ fontSize: 16, fontFamily: font.displayHeavy, color: color.accent, letterSpacing: -0.2 }}>
          {formatCurrency(displayPrice)}
          {hasDiscount && (
            <Text style={{ fontSize: 12, fontWeight: '500', color: color.inkFaint, textDecorationLine: 'line-through' }}>
              {'  '}{formatCurrency(product.price!)}
            </Text>
          )}
        </Text>
      </View>
    </PressableScale>
  );
});
