import React, { useState } from 'react';
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
import { color } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ReceiptIllustration } from '@/components/illustrations';
import { formatCurrency } from '@/lib/currency';
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

function OrdersList({ userId }: { userId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + 16;
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
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

  const COMPLETED_STATUSES = ['SUCCESSFUL', 'COMPLETED'];

  return (
    <>
      <FlashList
        data={orders}
        estimatedItemSize={140}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={color.accent} />
        }
        renderItem={({ item: order }) => {
          const items = (order.items as any[]) ?? [];
          const firstImg = items[0]?.imageUrl;
          const isCompleted = COMPLETED_STATUSES.includes(order.payment_status ?? '');

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/order/${order.id}` as any)}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
            >
              <View className="flex-row items-center justify-between mb-3">
                <View>
                  <Text variant="metaStrong" tone="muted">{order.external_id}</Text>
                  <Text variant="meta" tone="muted" style={{ marginTop: 2 }}>
                    {new Date(order.created_at!).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Badge label={order.payment_status} status={order.payment_status} />
              </View>

              <View className="flex-row items-center gap-3">
                {firstImg && (
                  <View className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100">
                    <Image source={{ uri: firstImg }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  </View>
                )}
                <View className="flex-1">
                  <Text variant="body" tone="muted" numberOfLines={1}>
                    {items.length} {items.length === 1 ? 'item' : 'items'} · {order.delivery_state}
                  </Text>
                  <Text variant="price" tone="accent" style={{ marginTop: 4 }}>
                    {formatCurrency(order.final_total)}
                  </Text>
                </View>
              </View>

              {/* Write review for completed orders */}
              {isCompleted && items.length > 0 && (
                <View className="mt-3 pt-3 border-t border-gray-50">
                  <Text variant="metaStrong" tone="muted" style={{ marginBottom: 8 }}>Leave a review:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {items.map((item: any) => {
                      const reviewed = isReviewed(order.id, item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          disabled={reviewed}
                          onPress={() => setReviewState({ order, item: { id: item.id, name: item.name, imageUrl: item.imageUrl } })}
                          className={`flex-row items-center gap-2 rounded-full px-3 py-2 border ${reviewed ? 'bg-gray-50 border-gray-100' : 'bg-primary-50 border-primary-100'}`}
                        >
                          {!reviewed && <Ionicons name="star-outline" size={13} color={color.accent} />}
                          <Text
                            variant="metaStrong"
                            tone={reviewed ? 'muted' : 'accent'}
                            numberOfLines={1}
                            style={{ maxWidth: 120 }}
                          >
                            {reviewed ? 'Reviewed ✓' : item.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
      <ReviewModal state={reviewState} onClose={() => setReviewState(null)} />
    </>
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
