import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Alert,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@/components/ui/List';
import { supabase } from '@/lib/supabase';
import { color, radius } from '@/theme/tokens';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { PressableScale } from '@/components/ui/PressableScale';
import { IconButton } from '@/components/ui/IconButton';
import { SkeletonBlock } from '@/components/ui/SkeletonLoader';
import { formatCurrency, discountPercent } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Product, Review } from '@/types';

const { width: SW, height: SH } = Dimensions.get('window');
const IMAGE_HEIGHT = Math.round(SH * 0.52);

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const toggle = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.isWishlisted);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const thumbListRef = useRef<FlatList>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_by_slug', { product_slug: slug });
      if (error) throw error;
      return data as unknown as Product;
    },
    enabled: !!slug,
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', product?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', product!.id!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Review[];
    },
    enabled: !!product?.id,
  });

  const images = product?.image_urls ?? [];
  const hasDiscount = product?.sale_price != null && product.sale_price < (product.price ?? 0);
  const discount = hasDiscount ? discountPercent(product!.price!, product!.sale_price!) : 0;
  const displayPrice = product?.sale_price ?? product?.price ?? 0;
  const inStock = (product?.stock ?? 0) > 0;
  const wishlisted = product ? isWishlisted(product.id ?? '') : false;
  const lowStock = inStock && (product?.stock ?? 0) <= 5;

  function scrollToImage(index: number) {
    setImageIndex(index);
    thumbListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }

  function handleAddToCart() {
    if (!product) return;
    if (product.sizes?.length && !selectedSize) {
      Alert.alert('Select a size', 'Please choose a size before adding to cart.');
      return;
    }
    if (product.colors?.length && !selectedColor) {
      Alert.alert('Select a color', 'Please choose a color before adding to cart.');
      return;
    }
    addItem({
      productId: product.id!,
      name: product.name!,
      brand: product.brand!,
      price: displayPrice,
      imageUrl: images[0] ?? '',
      slug: product.slug!,
      stock: product.stock!,
      size: selectedSize ?? undefined,
      color: selectedColor ?? undefined,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  function handleWishlist() {
    if (!product) return;
    toggle({
      productId: product.id!,
      name: product.name!,
      brand: product.brand!,
      price: product.price!,
      salePrice: product.sale_price ?? undefined,
      imageUrl: images[0] ?? '',
      slug: product.slug!,
      stock: product.stock!,
    });
  }

  async function handleShare() {
    if (!product) return;
    await Share.share({
      title: product.name ?? 'LitwaysPicks',
      message: `Check out ${product.name} on LitwaysPicks!\nlitwaypicks://product/${product.slug}`,
      url: `https://litwaypicks.com/product/${product.slug}`,
    });
  }

  if (isLoading || !product) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <SkeletonBlock height={IMAGE_HEIGHT} borderRadius={0} />
        <View style={{ padding: 20, gap: 12 }}>
          <SkeletonBlock height={12} width="40%" borderRadius={6} />
          <SkeletonBlock height={24} borderRadius={12} />
          <SkeletonBlock height={18} width="25%" borderRadius={9} />
          <SkeletonBlock height={48} borderRadius={12} />
          <SkeletonBlock height={120} borderRadius={12} />
        </View>
      </View>
    );
  }

  const avgRating = product.rating ?? 0;
  const reviewCount = product.review_count ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Floating nav bar */}
      <View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          zIndex: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
        }}
      >
        <IconButton icon="arrow-back" variant="dark" onPress={() => router.back()} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="share-outline" variant="dark" onPress={handleShare} />
          <PressableScale haptic onPress={handleWishlist} style={navBtnStyle}>
            <Ionicons
              name={wishlisted ? 'heart' : 'heart-outline'}
              size={20}
              color={wishlisted ? '#fca5a5' : '#fff'}
            />
          </PressableScale>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ─── Image gallery ─── */}
        <View style={{ height: IMAGE_HEIGHT }}>
          <FlatList
            data={images.length ? images : ['placeholder']}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
              setImageIndex(idx);
              thumbListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
            }}
            renderItem={({ item, index }) =>
              index === 0 ? (
                <Animated.View
                  sharedTransitionTag={`product-image-${product?.id}`}
                  style={{ width: SW, height: IMAGE_HEIGHT }}
                >
                  <Image
                    source={item !== 'placeholder' ? { uri: item } : undefined}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={200}
                    placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                  />
                </Animated.View>
              ) : (
                <Image
                  source={{ uri: item }}
                  style={{ width: SW, height: IMAGE_HEIGHT }}
                  contentFit="cover"
                  transition={200}
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                />
              )
            }
            keyExtractor={(_, i) => String(i)}
          />

          {/* Bottom gradient */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }}
          />

          {/* Discount badge */}
          {hasDiscount && (
            <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 110 : 68, left: 16, backgroundColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 }}>-{discount}% OFF</Text>
            </View>
          )}

          {/* Dot strip overlaid on gradient */}
          {images.length > 1 && (
            <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
              {images.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => scrollToImage(i)} hitSlop={8}>
                  <View style={{
                    width: i === imageIndex ? 22 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === imageIndex ? '#fff' : 'rgba(255,255,255,0.45)',
                  }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <FlatList
            ref={thumbListRef}
            data={images}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
            keyExtractor={(_, i) => `thumb-${i}`}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => scrollToImage(index)}>
                <View style={{
                  width: 60, height: 60,
                  borderRadius: 10,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: index === imageIndex ? color.accent : color.border,
                }}>
                  <Image
                    source={{ uri: item }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* ─── Product info ─── */}
        <View style={{ paddingHorizontal: 20 }}>

          {/* Brand + badges row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: color.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {product.brand}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {!inStock && (
                <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '700' }}>Out of Stock</Text>
                </View>
              )}
              {lowStock && (
                <View style={{ backgroundColor: color.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, color: color.accent, fontWeight: '700' }}>Only {product.stock} left!</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={{ fontSize: 20, fontWeight: '800', color: color.ink, lineHeight: 27, marginBottom: 10 }}>
            {product.name}
          </Text>

          {/* Rating bar */}
          {avgRating > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons key={star} name="star" size={14} color={star <= Math.round(avgRating) ? color.star : color.surfaceSunken} />
                ))}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: color.ink }}>{avgRating.toFixed(1)}</Text>
              <Text style={{ fontSize: 13, color: color.inkFaint }}>({reviewCount} reviews)</Text>
            </View>
          )}

          {/* Price block */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 20, backgroundColor: color.accentSoft, borderRadius: 14, padding: 14 }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: color.accent }}>
              {formatCurrency(displayPrice)}
            </Text>
            {hasDiscount && (
              <View>
                <Text style={{ fontSize: 15, color: color.inkFaint, textDecorationLine: 'line-through', lineHeight: 20 }}>
                  {formatCurrency(product.price!)}
                </Text>
                <Text style={{ fontSize: 12, color: color.danger, fontWeight: '700' }}>
                  You save {formatCurrency(product.price! - displayPrice)}
                </Text>
              </View>
            )}
          </View>

          {/* Sizes */}
          {product.sizes && product.sizes.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: color.ink }}>
                  Size {selectedSize ? <Text style={{ color: color.accent }}>· {selectedSize}</Text> : ''}
                </Text>
                <Text style={{ fontSize: 12, color: color.accent, fontWeight: '600' }}>Size guide</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {product.sizes.map((size) => (
                  <PressableScale
                    key={size}
                    haptic
                    onPress={() => setSelectedSize(size === selectedSize ? null : size)}
                    style={{
                      minWidth: 52,
                      height: 44,
                      paddingHorizontal: 14,
                      borderRadius: radius.full,
                      borderWidth: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selectedSize === size ? color.ink : color.surface,
                      borderColor: selectedSize === size ? color.ink : color.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selectedSize === size ? color.onInk : color.inkMuted }}>
                      {size}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          )}

          {/* Colors */}
          {product.colors && product.colors.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: color.ink, marginBottom: 10 }}>
                Color {selectedColor ? <Text style={{ color: color.accent }}>· {selectedColor}</Text> : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {product.colors.map((colorName) => (
                  <PressableScale
                    key={colorName}
                    haptic
                    onPress={() => setSelectedColor(colorName === selectedColor ? null : colorName)}
                    style={{
                      paddingHorizontal: 16,
                      height: 40,
                      borderRadius: radius.full,
                      borderWidth: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selectedColor === colorName ? color.ink : color.surface,
                      borderColor: selectedColor === colorName ? color.ink : color.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: selectedColor === colorName ? color.onInk : color.inkMuted }}>
                      {colorName}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: color.ink, marginBottom: 8 }}>Description</Text>
            <Text
              style={{ fontSize: 14, color: color.inkMuted, lineHeight: 22 }}
              numberOfLines={descExpanded ? undefined : 3}
            >
              {product.description}
            </Text>
            {(product.description?.length ?? 0) > 120 && (
              <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 13, color: color.accent, fontWeight: '600' }}>
                  {descExpanded ? 'Show less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Delivery card */}
          <View style={{ backgroundColor: '#f0fdf4', borderRadius: 16, padding: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ width: 36, height: 36, backgroundColor: '#16a34a', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="car-outline" size={18} color="#fff" />
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803d' }}>Free Delivery Nationwide</Text>
                <Text style={{ fontSize: 11, color: '#16a34a', marginTop: 1 }}>All 15 Liberian counties · MTN MoMo</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="shield-checkmark-outline" size={13} color="#16a34a" />
                <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '600' }}>Buyer protection</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="refresh-outline" size={13} color="#16a34a" />
                <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '600' }}>Easy returns</Text>
              </View>
            </View>
          </View>

          {/* Reviews */}
          {reviews && reviews.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              {/* Rating summary */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: color.ink }}>
                  Reviews ({reviewCount})
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.star + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Ionicons name="star" size={13} color={color.star} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: color.star }}>{avgRating.toFixed(1)}</Text>
                </View>
              </View>
              {reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: color.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={15} color={color.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons key={s} name="star" size={11} color={s <= review.rating ? color.star : color.surfaceSunken} />
                        ))}
                      </View>
                      <Text style={{ fontSize: 11, color: color.inkFaint }}>
                        {new Date(review.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {review.comment && (
                    <Text style={{ fontSize: 13, color: color.inkMuted, lineHeight: 20, marginLeft: 38 }}>
                      {review.comment}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── Sticky CTA bar ─── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          backgroundColor: color.surface,
          borderTopWidth: 1,
          borderTopColor: color.border,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 32 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <PressableScale
          haptic
          onPress={handleWishlist}
          style={{
            width: 48, height: 48,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: wishlisted ? '#ef4444' : color.border,
            backgroundColor: wishlisted ? '#fff1f2' : color.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={wishlisted ? 'heart' : 'heart-outline'} size={22} color={wishlisted ? '#ef4444' : color.inkMuted} />
        </PressableScale>

        <TouchableOpacity
          onPress={handleAddToCart}
          disabled={!inStock}
          activeOpacity={0.85}
          style={{
            flex: 1,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: addedToCart ? color.success : (inStock ? color.accent : color.surfaceSunken),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Ionicons
            name={addedToCart ? 'checkmark-circle-outline' : 'bag-add-outline'}
            size={20}
            color={inStock || addedToCart ? '#fff' : color.inkFaint}
          />
          <View>
            <Text style={{ color: inStock || addedToCart ? '#fff' : color.inkFaint, fontSize: 16, fontWeight: '800' }}>
              {addedToCart ? 'Added to Cart!' : inStock ? 'Add to Cart' : 'Out of Stock'}
            </Text>
            {inStock && !addedToCart && (
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>
                {formatCurrency(displayPrice)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const navBtnStyle = {
  width: 40,
  height: 40,
  backgroundColor: 'rgba(0,0,0,0.38)',
  borderRadius: 20,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
