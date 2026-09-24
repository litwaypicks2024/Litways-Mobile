import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Share,
  ActivityIndicator,
  RefreshControl,
  type GestureResponderEvent,
} from 'react-native';
import { flyToCart } from '@/components/motion/FlyToCart';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  withSequence,
  withSpring,
  ReduceMotion,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@/components/ui/List';
import { supabase } from '@/lib/supabase';
import { color, radius } from '@/theme/tokens';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { useTasteStore } from '@/store/taste';
import { PressableScale } from '@/components/ui/PressableScale';
import { IconButton } from '@/components/ui/IconButton';
import { SkeletonBlock, ProductCardSkeleton } from '@/components/ui/SkeletonLoader';
import { ProductCard } from '@/components/shop/ProductCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, discountPercent } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Product, Review } from '@/types';
import { Text } from '@/components/ui/Text';

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
  const scrollRef = useRef<Animated.ScrollView>(null);
  const galleryRef = useRef<FlatList>(null);
  const [quantity, setQuantity] = useState(1);
  const cartCount = useCartStore((s) => s.itemCount());
  // Which required option the shopper skipped — highlights that section inline
  // instead of interrupting with a modal alert.
  const [missing, setMissing] = useState<'size' | 'color' | null>(null);
  const infoY = useRef(0);
  const innerY = useRef(0);
  const sectionY = useRef<{ size: number; color: number }>({ size: 0, color: 0 });

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const galleryAnimatedStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    // Overscroll (pulling down past the top): stretch the hero image.
    const scale = interpolate(y, [-200, 0], [1.35, 1], Extrapolation.CLAMP);
    // Normal scroll down: pin the image to the top of the screen so the
    // product sheet slides up and over it, rather than the photo scrolling
    // away with the page.
    const parallaxTranslateY = interpolate(y, [0, IMAGE_HEIGHT], [0, IMAGE_HEIGHT], Extrapolation.CLAMP);
    // When stretching, compensate translateY by half the extra height so the
    // growth extends upward (filling the pulled-down gap) instead of also
    // pushing into the content below. transform: [{ translateY }, { scale }]
    // applies scale first (about center) then translateY in the parent's
    // coordinate space, so after scaling the bottom edge has already moved
    // down by +H(s-1)/2; translating by the NEGATIVE of that pulls it back
    // to pin the bottom edge and pushes the top edge up by the full extra
    // height, filling the overscroll gap above instead of ballooning down
    // over the thumbnail strip / product info below.
    const stretchTranslateY = -(IMAGE_HEIGHT * (scale - 1)) / 2;
    return {
      transform: [
        { translateY: y < 0 ? stretchTranslateY : parallaxTranslateY },
        { scale },
      ],
    };
  });

  // Scroll offset at which the product name has left the screen; the top bar
  // fades its title in as the shopper crosses it.
  const titleThreshold = useSharedValue(IMAGE_HEIGHT);
  const nameY = useRef(0);
  function updateTitleThreshold() {
    titleThreshold.value = infoY.current + innerY.current + nameY.current + 24 - (insets.top + 60);
  }
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [titleThreshold.value - 24, titleThreshold.value], [0, 1], Extrapolation.CLAMP),
  }));

  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const { data: product, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_by_slug', { product_slug: slug });
      if (error) throw error;
      return data as unknown as Product;
    },
    enabled: !!slug,
  });

  // Feed the shopper's taste profile (recently viewed + category interest)
  // once per product opened, not on every refetch.
  const viewedId = product?.id;
  useEffect(() => {
    if (product && viewedId) useTasteStore.getState().recordView(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedId]);

  const {
    data: reviews,
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useQuery({
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

  // "You may also like": same category first, topped up with the best-rated
  // other in-stock products so the section is never thin on a small category.
  const { data: related, isLoading: relatedLoading } = useQuery({
    queryKey: ['related-products', product?.id],
    queryFn: async () => {
      const LIMIT = 10;
      const base = () =>
        supabase.from('products_with_categories').select('*').neq('id', product!.id!).gt('stock', 0);
      let picks: Product[] = [];
      if (product!.category_slug) {
        const { data, error } = await base()
          .eq('category_slug', product!.category_slug)
          .order('rating', { ascending: false, nullsFirst: false })
          .limit(LIMIT);
        if (error) throw error;
        picks = (data ?? []) as Product[];
      }
      if (picks.length < LIMIT) {
        const { data, error } = await base()
          .order('rating', { ascending: false, nullsFirst: false })
          .limit(LIMIT + picks.length);
        if (error) throw error;
        const have = new Set(picks.map((p) => p.id));
        picks = [...picks, ...((data ?? []) as Product[]).filter((p) => !have.has(p.id))].slice(0, LIMIT);
      }
      return picks;
    },
    enabled: !!product?.id,
    staleTime: 5 * 60 * 1000,
  });

  const images = product?.image_urls ?? [];
  const hasDiscount = product?.sale_price != null && product.sale_price < (product.price ?? 0);
  const discount = hasDiscount ? discountPercent(product!.price!, product!.sale_price!) : 0;
  const displayPrice = product?.sale_price ?? product?.price ?? 0;
  const inStock = (product?.stock ?? 0) > 0;
  const wishlisted = product ? isWishlisted(product.id ?? '') : false;
  const lowStock = inStock && (product?.stock ?? 0) <= 5;

  // Drives the main gallery itself — thumbnails, arrows and swipes all funnel
  // through here so the hero image always matches the highlighted thumbnail.
  function scrollToImage(index: number) {
    const next = Math.max(0, Math.min(index, images.length - 1));
    setImageIndex(next);
    galleryRef.current?.scrollToOffset({ offset: next * SW, animated: true });
    thumbListRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
  }

  function handleAddToCart(e?: GestureResponderEvent) {
    if (!product) return;
    const skipped = product.sizes?.length && !selectedSize ? 'size'
      : product.colors?.length && !selectedColor ? 'color'
      : null;
    if (skipped) {
      setMissing(skipped);
      scrollRef.current?.scrollTo({ y: Math.max(infoY.current + innerY.current + sectionY.current[skipped] - 96, 0), animated: true });
      return;
    }
    if (e?.nativeEvent) {
      flyToCart(e.nativeEvent.pageX, e.nativeEvent.pageY);
    }
    const line = {
      productId: product.id!,
      name: product.name!,
      brand: product.brand!,
      price: displayPrice,
      listPrice: hasDiscount ? product.price ?? undefined : undefined,
      imageUrl: images[0] ?? '',
      slug: product.slug!,
      stock: product.stock!,
      size: selectedSize ?? undefined,
      color: selectedColor ?? undefined,
    };
    // addItem adds one unit per call and caps at stock.
    for (let i = 0; i < quantity; i++) addItem(line);
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
      categorySlug: product.category_slug ?? undefined,
      categoryName: product.category_name ?? undefined,
    });
  }

  async function handleShare() {
    if (!product) return;
    await Share.share({
      title: product.name ?? 'Litway Picks',
      message: `Check out ${product.name} on Litway Picks!\nlitwaypicks://product/${product.slug}`,
      url: `https://www.litwaypicks.com/product/${product.slug}`,
    });
  }

  // A lone size/colour isn't a choice — preselect it so nobody is blocked.
  useEffect(() => {
    if (!product) return;
    if (product.sizes?.length === 1) setSelectedSize((v) => v ?? product.sizes![0]);
    if (product.colors?.length === 1) setSelectedColor((v) => v ?? product.colors![0]);
  }, [product]);

  useEffect(() => {
    if (addedToCart) {
      ctaScale.value = withSequence(
        withSpring(1.06, { reduceMotion: ReduceMotion.System }),
        withSpring(1, { reduceMotion: ReduceMotion.System }),
      );
    }
  }, [addedToCart, ctaScale]);

  if (isLoading) {
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

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
        <ErrorState
          message="Couldn't load this product. Check your connection and try again."
          onRetry={() => refetch()}
          loading={isFetching}
        />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
        <EmptyState
          icon="help-circle-outline"
          title="Product not found"
          description="This product may have been removed, or the link is incorrect."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const avgRating = product.rating ?? 0;
  const reviewCount = product.review_count ?? 0;
  const needsSize = !!product.sizes?.length && !selectedSize;
  const needsColor = !!product.colors?.length && !selectedColor;
  const maxQty = Math.max(1, Math.min(product.stock ?? 1, 10));
  const ctaLabel = !inStock ? 'Out of stock'
    : addedToCart ? 'Added to cart'
    : needsSize ? 'Select a size'
    : needsColor ? 'Select a color'
    : 'Add to cart';
  const GUTTER = 20;

  return (
    <View style={{ flex: 1, backgroundColor: color.surface }}>
      {/* Solid bar + product name, fades in once the name has scrolled away */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 19,
            height: insets.top + 68,
            backgroundColor: color.surface,
            borderBottomWidth: 1, borderBottomColor: color.border,
            justifyContent: 'flex-end',
          },
          barStyle,
        ]}
      >
        <View style={{ height: 42, marginBottom: 10, justifyContent: 'center', marginLeft: 70, marginRight: 116 }}>
          <Text variant="heading" numberOfLines={1}>
            {product.name}
          </Text>
        </View>
      </Animated.View>

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
        <IconButton icon="arrow-back" variant="dark" onPress={() => router.back()} accessibilityLabel="Go back" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="share-outline" variant="dark" onPress={handleShare} accessibilityLabel="Share product" />
          <IconButton
            icon={wishlisted ? 'heart' : 'heart-outline'}
            variant="dark"
            iconColor={wishlisted ? '#fca5a5' : undefined}
            onPress={handleWishlist}
            accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            accessibilityState={{ selected: wishlisted }}
          />
        </View>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 92 + Math.max(insets.bottom, 16) }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={color.accent} />
        }
      >
        {/* ─── Image gallery ─── */}
        <Animated.View style={[{ height: IMAGE_HEIGHT }, galleryAnimatedStyle]}>
          <FlatList
            ref={galleryRef}
            data={images.length ? images : ['placeholder']}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            bounces={images.length > 1}
            scrollEnabled={images.length > 1}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
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

          {/* Overlays never eat swipes meant for the gallery */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.35)', 'transparent']}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 90 }}
          />

          {hasDiscount && (
            <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 72, left: 16, backgroundColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text variant="small" style={{ color: '#fff' }}>-{discount}% OFF</Text>
            </View>
          )}

          {/* Explicit gallery controls: arrows + counter, so navigation is never a guess */}
          {images.length > 1 && (
            <>
              {imageIndex > 0 && (
                <TouchableOpacity
                  onPress={() => scrollToImage(imageIndex - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Previous image"
                  hitSlop={8}
                  style={{ position: 'absolute', left: 12, top: IMAGE_HEIGHT / 2 - 18, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,20,20,0.45)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="chevron-back" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              {imageIndex < images.length - 1 && (
                <TouchableOpacity
                  onPress={() => scrollToImage(imageIndex + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Next image"
                  hitSlop={8}
                  style={{ position: 'absolute', right: 12, top: IMAGE_HEIGHT / 2 - 18, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,20,20,0.45)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <View
                pointerEvents="none"
                style={{ position: 'absolute', right: 16, bottom: 36, backgroundColor: 'rgba(20,20,20,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}
              >
                <Text variant="metaStrong" style={{ color: '#fff' }}>{imageIndex + 1} / {images.length}</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* ─── Product sheet: overlaps the image so the page reads as one flow ─── */}
        <View
          onLayout={(e) => { infoY.current = e.nativeEvent.layout.y; updateTitleThreshold(); }}
          style={{ backgroundColor: color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, paddingTop: 16 }}
        >
          {/* Thumbnails, aligned to the same gutter as the content */}
          {images.length > 1 && (
            <FlatList
              ref={thumbListRef}
              data={images}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 16, gap: 8 }}
              keyExtractor={(_, i) => `thumb-${i}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => scrollToImage(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show image ${index + 1} of ${images.length}`}
                  accessibilityState={{ selected: index === imageIndex }}
                >
                  <View style={{
                    width: 60, height: 60,
                    borderRadius: 10,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: index === imageIndex ? color.accent : color.border,
                    opacity: index === imageIndex ? 1 : 0.7,
                  }}>
                    <Image source={{ uri: item }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          <View onLayout={(e) => { innerY.current = e.nativeEvent.layout.y; updateTitleThreshold(); }} style={{ paddingHorizontal: GUTTER }}>
            {/* Identity: brand, name, rating */}
            <Text variant="metaStrong" tone="body" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
              {product.brand}
            </Text>
            <Text variant="title"
              onLayout={(e) => { nameY.current = e.nativeEvent.layout.y; updateTitleThreshold(); }}
              style={{ marginBottom: 8 }}
            >
              {product.name}
            </Text>
            {avgRating > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={14} color={star <= Math.round(avgRating) ? color.star : color.surfaceSunken} />
                  ))}
                </View>
                <Text variant="small">{avgRating.toFixed(1)}</Text>
                <Text variant="caption" tone="body">({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</Text>
              </View>
            )}

            {/* Price + availability, together */}
            <View style={{ backgroundColor: color.accentSoft, borderRadius: 14, padding: 14, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <Text variant="display" tone="accent">
                  {formatCurrency(displayPrice)}
                </Text>
                {hasDiscount && (
                  <View>
                    <Text variant="bodyLg" tone="body" style={{ textDecorationLine: 'line-through' }}>
                      {formatCurrency(product.price!)}
                    </Text>
                    <Text variant="metaStrong" tone="danger">
                      You save {formatCurrency(product.price! - displayPrice)}
                    </Text>
                  </View>
                )}
              </View>
              {(!inStock || lowStock) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: !inStock ? color.danger : color.accent }} />
                  <Text variant="small" style={{ color: !inStock ? color.danger : color.accentPressed }}>
                    {!inStock ? 'Out of stock' : `Only ${product.stock} left, order soon`}
                  </Text>
                </View>
              )}
            </View>

            {/* Sizes */}
            {product.sizes && product.sizes.length > 0 && (
              <View style={{ marginBottom: 24 }} onLayout={(e) => { sectionY.current.size = e.nativeEvent.layout.y; }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Text variant="button">
                    Size{selectedSize ? <Text tone="accent">  {selectedSize}</Text> : ''}
                  </Text>
                  {!selectedSize && (
                    <Text variant="metaStrong" style={{ color: missing === 'size' ? color.danger : color.accentPressed }}>
                      {missing === 'size' ? 'Select a size to continue' : 'Required'}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {product.sizes.map((size) => (
                    <PressableScale
                      key={size}
                      haptic
                      onPress={() => { setSelectedSize(size === selectedSize ? null : size); setMissing(null); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedSize === size }}
                      style={{
                        minWidth: 52,
                        height: 44,
                        paddingHorizontal: 14,
                        borderRadius: radius.full,
                        borderWidth: 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selectedSize === size ? color.ink : color.surface,
                        borderColor: selectedSize === size ? color.ink : missing === 'size' ? color.danger : color.border,
                      }}
                    >
                      <Text variant="bodyStrong" style={{ color: selectedSize === size ? color.onInk : color.ink }}>
                        {size}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            )}

            {/* Colors */}
            {product.colors && product.colors.length > 0 && (
              <View style={{ marginBottom: 24 }} onLayout={(e) => { sectionY.current.color = e.nativeEvent.layout.y; }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Text variant="button">
                    Color{selectedColor ? <Text tone="accent">  {selectedColor}</Text> : ''}
                  </Text>
                  {!selectedColor && (
                    <Text variant="metaStrong" style={{ color: missing === 'color' ? color.danger : color.accentPressed }}>
                      {missing === 'color' ? 'Select a color to continue' : 'Required'}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {product.colors.map((colorName) => (
                    <PressableScale
                      key={colorName}
                      haptic
                      onPress={() => { setSelectedColor(colorName === selectedColor ? null : colorName); setMissing(null); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedColor === colorName }}
                      style={{
                        paddingHorizontal: 16,
                        height: 44,
                        borderRadius: radius.full,
                        borderWidth: 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selectedColor === colorName ? color.ink : color.surface,
                        borderColor: selectedColor === colorName ? color.ink : missing === 'color' ? color.danger : color.border,
                      }}
                    >
                      <Text variant="bodyStrong" style={{ color: selectedColor === colorName ? color.onInk : color.ink }}>
                        {colorName}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            )}

            {/* Quantity */}
            {inStock && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Text variant="button">Quantity</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: color.border, borderRadius: radius.full }}>
                  <TouchableOpacity
                    onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease quantity"
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: quantity <= 1 ? 0.35 : 1 }}
                  >
                    <Ionicons name="remove" size={20} color={color.ink} />
                  </TouchableOpacity>
                  <Text variant="heading" style={{ minWidth: 32, textAlign: 'center' }} accessibilityLabel={`Quantity ${quantity}`}>
                    {quantity}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    disabled={quantity >= maxQty}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Increase quantity"
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: quantity >= maxQty ? 0.35 : 1 }}
                  >
                    <Ionicons name="add" size={20} color={color.ink} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Description */}
            {!!product.description && (
              <View style={{ marginBottom: 24 }}>
                <Text variant="button" style={{ marginBottom: 8 }}>Description</Text>
                <Text variant="bodyLg" tone="body"
                  
                  numberOfLines={descExpanded ? undefined : 4}>
                  {product.description}
                </Text>
                {product.description.length > 140 && (
                  <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} style={{ marginTop: 8 }} hitSlop={8}>
                    <Text variant="bodyStrong" tone="accent">
                      {descExpanded ? 'Show less' : 'Read more'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Delivery & returns — quiet icon rows, the way Apple/Ulta/eBay do it */}
            <View style={{ marginBottom: 24, borderTopWidth: 1, borderTopColor: color.border }}>
              {[
                { icon: 'car-outline', title: 'Delivery to all 15 counties', sub: 'Pay with MTN Mobile Money at checkout' },
                { icon: 'shield-checkmark-outline', title: 'Buyer protection', sub: 'Your payment is secured until you order' },
                { icon: 'refresh-outline', title: 'Easy returns', sub: 'Unused items in original condition' },
              ].map((row) => (
                <View
                  key={row.title}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: color.border,
                  }}
                >
                  <Ionicons name={row.icon as any} size={22} color={color.ink} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyLg" weight="semibold">{row.title}</Text>
                    <Text variant="caption" tone="body" style={{ marginTop: 1 }}>{row.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Reviews */}
            {reviewsLoading ? (
              <View style={{ marginBottom: 24, gap: 8 }}>
                <SkeletonBlock height={16} width="35%" borderRadius={8} />
                <SkeletonBlock height={52} borderRadius={12} />
              </View>
            ) : reviewsError ? (
              <View style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="caption" tone="body">Couldn't load reviews.</Text>
                <TouchableOpacity onPress={() => refetchReviews()} hitSlop={8}>
                  <Text variant="small" tone="accent">Retry</Text>
                </TouchableOpacity>
              </View>
            ) : reviews && reviews.length > 0 && (
              <View style={{ marginBottom: 8, borderTopWidth: 1, borderTopColor: color.border, paddingTop: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Text variant="heading">
                    Reviews ({reviewCount})
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.star + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Ionicons name="star" size={13} color={color.star} />
                    <Text variant="small" style={{ color: '#92400e' }}>{avgRating.toFixed(1)}</Text>
                  </View>
                </View>
                {reviews.slice(0, 5).map((review, i, arr) => (
                  <View key={review.id} style={{ marginBottom: i === arr.length - 1 ? 0 : 16, paddingBottom: i === arr.length - 1 ? 0 : 16, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: color.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="person" size={15} color={color.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map((st) => (
                            <Ionicons key={st} name="star" size={12} color={st <= review.rating ? color.star : color.surfaceSunken} />
                          ))}
                        </View>
                        <Text variant="meta" tone="body" style={{ marginTop: 1 }}>
                          {new Date(review.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                    {review.comment && (
                      <Text variant="body" tone="body" style={{ marginLeft: 42 }}>
                        {review.comment}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ─── You may also like — full-bleed carousel, cards peek to signal more ─── */}
          {(relatedLoading || (related && related.length > 0)) && (
            <View style={{ marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: color.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, marginBottom: 14 }}>
                <Text variant="heading">You may also like</Text>
                <TouchableOpacity
                  onPress={() =>
                    router.push(product.category_slug ? `/category/${product.category_slug}` : '/(tabs)/shop')
                  }
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="See all similar products"
                >
                  <Text variant="bodyStrong" tone="accent">See all</Text>
                </TouchableOpacity>
              </View>
              {relatedLoading ? (
                <View style={{ flexDirection: 'row', paddingHorizontal: GUTTER }}>
                  {[0, 1, 2].map((i) => <ProductCardSkeleton key={i} />)}
                </View>
              ) : (
                <FlatList
                  data={related}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 12 }}
                  keyExtractor={(item) => item.id ?? ''}
                  renderItem={({ item }) => <ProductCard product={item} width={160} variant="horizontal" />}
                />
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* ─── Sticky bar: cart shortcut + one clear action ─── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          backgroundColor: color.surface,
          borderTopWidth: 1,
          borderTopColor: color.border,
          paddingHorizontal: GUTTER,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <IconButton
          icon="bag-outline"
          size={52}
          iconSize={22}
          badge={cartCount}
          onPress={() => router.push('/(tabs)/cart')}
          accessibilityLabel={cartCount > 0 ? `View cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}` : 'View cart'}
          style={{ borderWidth: 1.5, borderColor: color.border, shadowOpacity: 0, elevation: 0 }}
        />

        <TouchableOpacity
          onPress={handleAddToCart}
          disabled={!inStock}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          style={{
            flex: 1,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: addedToCart ? color.success : (inStock ? color.accent : color.surfaceSunken),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, ctaAnimatedStyle]}>
            <Ionicons
              name={addedToCart ? 'checkmark-circle-outline' : needsSize || needsColor ? 'options-outline' : 'bag-add-outline'}
              size={20}
              color={inStock ? '#fff' : color.inkBody}
            />
            <Text variant="button" style={{ color: inStock ? '#fff' : color.inkBody, fontSize: 16 }}>
              {ctaLabel}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
