import React, { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@/components/ui/List';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useReviewedStore } from '@/store/reviewed';
import { color, gutter, radius, shadow, spacing } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ReceiptIllustration } from '@/components/illustrations';
import { formatCurrency } from '@/lib/currency';
import { buyAgain } from '@/lib/moveToCart';
import { orderStatus, shortOrderId, type OrderGroup } from '@/lib/orderStatus';
import { showToast } from '@/components/ui/Toast';
import { alertDialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import type { Order } from '@/types';

interface ReviewState {
  order: Order;
  item: { id: string; name: string; imageUrl?: string };
}

function ReviewModal({ state, onClose }: { state: ReviewState | null; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const markReviewed = useReviewedStore((s) => s.markReviewed);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Shown inline: the app dialog is an overlay and can't sit above this Modal.
  const [error, setError] = useState<string | null>(null);

  if (!state) return null;

  async function handleSubmit() {
    if (!rating) return;
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      product_id: state!.item.id,
      order_id: state!.order.id,
      user_id: user!.id,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setError('Could not submit review. You may have already reviewed this product.');
    } else {
      markReviewed(state!.order.id, state!.item.id);
      queryClient.invalidateQueries({ queryKey: ['reviews', state!.item.id] });
      alertDialog('Review submitted', 'Thank you for your feedback!');
      setRating(5);
      setComment('');
      onClose();
    }
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View
            className="bg-white rounded-t-3xl px-6 pt-5 pb-10"
            style={{ paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}
          >
            {/* Handle */}
            <View className="items-center mb-4">
              <View className="w-10 h-1 bg-gray-200 rounded-full" />
            </View>

            <Text variant="heading" style={{ marginBottom: 4 }}>Write a Review</Text>
            <Text variant="body" tone="muted" numberOfLines={1} style={{ marginBottom: 20 }}>{state.item.name}</Text>

            {/* Star rating */}
            <Text variant="bodyStrong" style={{ marginBottom: 8 }}>Your Rating</Text>
            <View className="flex-row gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  accessibilityState={{ selected: star <= rating }}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? color.star : color.surfaceSunken}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment */}
            <Text variant="bodyStrong" style={{ marginBottom: 8 }}>Comment (optional)</Text>
            <Input
              value={comment}
              onChangeText={setComment}
              placeholder="Share your experience with this product..."
              multiline
              numberOfLines={4}
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />

            {!!error && (
              <Text variant="body" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: 12 }}>{error}</Text>
            )}

            <View className="flex-row gap-3">
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Submit Review" onPress={handleSubmit} loading={submitting} style={{ flex: 1 }} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type Filter = 'all' | OrderGroup;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function OrdersList({ userId }: { userId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + 16;
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [reordering, setReordering] = useState<string | null>(null);
  const isReviewed = useReviewedStore((s) => s.isReviewed);

  const { data: orders, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['my-orders', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, progress: 0, completed: 0, cancelled: 0 };
    for (const o of orders ?? []) {
      c.all++;
      c[orderStatus(o.payment_status).group]++;
    }
    return c;
  }, [orders]);

  const visible = useMemo(
    () => (orders ?? []).filter((o) => filter === 'all' || orderStatus(o.payment_status).group === filter),
    [orders, filter]
  );

  async function handleBuyAgain(order: Order) {
    const items = ((order.items as any[]) ?? []).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, imageUrl: i.imageUrl }));
    setReordering(order.id);
    try {
      const r = await buyAgain(items);
      const lines: string[] = [];
      if (r.needsChoice.length) lines.push(`Choose a size or colour: ${r.needsChoice.map((i) => i.name).join(', ')}.`);
      if (r.unavailable.length) lines.push(`Sold out: ${r.unavailable.map((i) => i.name).join(', ')}.`);
      if (r.atLimit.length) lines.push(`Already in your cart at the most available: ${r.atLimit.map((i) => i.name).join(', ')}.`);
      const skipped = r.needsChoice.length + r.unavailable.length + r.atLimit.length;

      if (r.added.length && !skipped) {
        showToast({
          title: r.added.length === 1 ? 'Added 1 item to your cart' : `Added ${r.added.length} items to your cart`,
          tone: 'success',
          action: { label: 'View cart', href: '/(tabs)/cart' },
        });
      } else if (r.added.length) {
        alertDialog(
          `Added ${r.added.length} of ${items.length} to your cart`,
          lines.join(' '),
          [{ text: 'View cart', onPress: () => router.push('/(tabs)/cart') }, { text: 'Stay here', style: 'cancel' }],
          'success'
        );
      } else {
        alertDialog("Couldn't add anything", lines.join(' ') || 'Nothing from this order is available right now.', [{ text: 'OK' }], 'warning');
      }
    } catch {
      alertDialog("Couldn't reorder", 'Check your connection and try again.', [{ text: 'OK' }], 'warning');
    } finally {
      setReordering(null);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Couldn't load your orders. Check your connection and try again."
        onRetry={() => refetch()}
        loading={isFetching}
      />
    );
  }

  if (!orders?.length) {
    return (
      <EmptyState
        illustration={<ReceiptIllustration />}
        title="No orders yet"
        description="Your order history will appear here."
        actionLabel="Start Shopping"
        onAction={() => router.push('/(tabs)/shop')}
      />
    );
  }

  return (
    <>
      {/* Filter pills, with counts */}
      <View style={{ backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 10, gap: 8 }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
                  backgroundColor: active ? color.ink : color.surface,
                  borderWidth: 1.5, borderColor: active ? color.ink : color.fieldBorder,
                }}
              >
                <Text variant="small" style={{ color: active ? color.onInk : color.ink }}>
                  {f.label}{counts[f.key] ? ` · ${counts[f.key]}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {!visible.length ? (
        <EmptyState
          illustration={<ReceiptIllustration />}
          title={{ all: 'No orders yet', progress: 'No orders in progress', completed: 'No completed orders', cancelled: 'No cancelled orders' }[filter]}
          description="Orders in this state will show up here."
          actionLabel="See all orders"
          onAction={() => setFilter('all')}
        />
      ) : (
        <FlashList
          data={visible}
          estimatedItemSize={230}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={color.accent} />}
          renderItem={({ item: order }) => (
            <OrderCard
              order={order}
              reordering={reordering === order.id}
              isReviewed={isReviewed}
              onOpen={() => router.push(`/order/${order.id}` as any)}
              onBuyAgain={() => handleBuyAgain(order)}
              onCheckStatus={() =>
                order.reference_id &&
                router.push({ pathname: '/confirmation', params: { referenceId: order.reference_id } } as any)
              }
              onReview={(item) => setReviewState({ order, item })}
            />
          )}
        />
      )}
      <ReviewModal state={reviewState} onClose={() => setReviewState(null)} />
    </>
  );
}

const THUMB = 56;
const MAX_THUMBS = 4;

function OrderCard({
  order, reordering, isReviewed, onOpen, onBuyAgain, onCheckStatus, onReview,
}: {
  order: Order;
  reordering: boolean;
  isReviewed: (orderId: string, productId: string) => boolean;
  onOpen: () => void;
  onBuyAgain: () => void;
  onCheckStatus: () => void;
  onReview: (item: { id: string; name: string; imageUrl?: string }) => void;
}) {
  const status = orderStatus(order.payment_status);
  const items = ((order.items as any[]) ?? []) as { id: string; name: string; imageUrl?: string; quantity?: number }[];
  const unitCount = items.reduce((n, i) => n + (i.quantity ?? 1), 0);
  const shown = items.slice(0, MAX_THUMBS);
  const extra = items.length - shown.length;
  const canReview = ['SUCCESSFUL', 'COMPLETED'].includes(order.payment_status ?? '') && items.length > 0;
  const toReview = canReview ? items.filter((i) => !isReviewed(order.id, i.id)) : [];

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Order ${shortOrderId(order.external_id)}, ${status.label}, ${formatCurrency(order.final_total)}`}
      style={{ backgroundColor: color.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card }}
    >
      {/* Status + date */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: status.bg, paddingHorizontal: 10, height: 28, borderRadius: 14, flexShrink: 1 }}>
          <Ionicons name={status.icon} size={15} color={status.fg} />
          <Text variant="metaStrong" numberOfLines={1} style={{ color: status.fg }}>{status.label}</Text>
        </View>
        <Text variant="meta" tone="muted" numberOfLines={1}>
          {new Date(order.created_at!).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>

      <Text variant="bodyStrong" style={{ marginTop: spacing.md }}>Order {shortOrderId(order.external_id)}</Text>

      {/* Item thumbnails */}
      {items.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          {shown.map((it, i) => (
            <View key={`${it.id}-${i}`} style={{ width: THUMB, height: THUMB, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
              {it.imageUrl ? (
                <Image source={{ uri: it.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Ionicons name="cube-outline" size={22} color={color.inkFaint} />
              )}
            </View>
          ))}
          {extra > 0 && (
            <View style={{ width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: color.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="bodyStrong" tone="body">+{extra}</Text>
            </View>
          )}
        </View>
      )}

      {/* Summary + total */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" tone="muted" numberOfLines={1}>
            {unitCount} {unitCount === 1 ? 'item' : 'items'}{order.delivery_state ? ` · ${order.delivery_state}` : ''}
          </Text>
          {order.payment_status === 'FAILED' && (
            <Text variant="meta" tone="danger" numberOfLines={2} style={{ marginTop: 2 }}>
              {order.failure_reason || 'This payment did not go through. You were not charged.'}
            </Text>
          )}
        </View>
        <Text variant="priceLg" tone="accent" style={{ flexShrink: 0 }}>{formatCurrency(order.final_total)}</Text>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: color.border }}>
        {order.payment_status === 'PENDING' && !!order.reference_id && (
          <Button title="Check status" size="sm" variant="outline" onPress={onCheckStatus} />
        )}
        <Button title="View details" size="sm" variant="outline" onPress={onOpen} />
        {items.length > 0 && order.payment_status !== 'PENDING' && (
          <Button title="Buy again" size="sm" onPress={onBuyAgain} loading={reordering} />
        )}
      </View>

      {/* Reviews for delivered items */}
      {toReview.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <Text variant="metaStrong" tone="muted" style={{ marginBottom: 8 }}>Rate your items</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {toReview.map((it) => (
              <TouchableOpacity
                key={it.id}
                onPress={() => onReview({ id: it.id, name: it.name, imageUrl: it.imageUrl })}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.peachTint }}
              >
                <Ionicons name="star-outline" size={13} color={color.accent} />
                <Text variant="metaStrong" tone="accent" numberOfLines={1} style={{ maxWidth: 140 }}>{it.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="My orders" onBack={() => router.back()} />
      {user ? (
        <OrdersList userId={user.id} />
      ) : (
        <EmptyState
          icon="person-circle-outline"
          title="Sign in to see your orders"
          actionLabel="Sign In"
          onAction={() => router.replace('/(auth)/login')}
        />
      )}
    </View>
  );
}
