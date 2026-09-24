import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency } from '@/lib/currency';
import { shortOrderId } from '@/lib/orderStatus';
import { useOrderImages } from '@/lib/orderImages';
import type { Order } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: order, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Order;
    },
    enabled: !!id,
  });

  const imageFor = useOrderImages((order?.items as any[]) ?? []);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        className="bg-white border-b border-gray-100 px-5 pb-4 flex-row items-center gap-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text variant="heading">Order Details</Text>
          {order?.external_id && (
            <Text variant="metaStrong" tone="muted">{shortOrderId(order.external_id)}</Text>
          )}
        </View>
        {order && <Badge label={order.payment_status} status={order.payment_status} />}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary[500]} />
        </View>
      ) : isError ? (
        <ErrorState
          message="Couldn't load this order. Check your connection and try again."
          onRetry={() => refetch()}
          loading={isFetching}
        />
      ) : !order ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="receipt-outline" size={48} color={Colors.gray[300]} />
          <Text variant="heading" tone="body" style={{ marginTop: 16, textAlign: 'center' }}>Order not found</Text>
          <Button title="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Date + status */}
          <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <Text variant="overline" tone="muted" style={{ marginBottom: 12 }}>Order Info</Text>
            <InfoRow label="Date" value={new Date(order.created_at!).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} />
            <InfoRow label="Status" value={order.payment_status ?? '—'} highlight />
            <InfoRow label="Total" value={formatCurrency(order.final_total)} highlight />
          </View>

          {/* Delivery */}
          <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <Text variant="overline" tone="muted" style={{ marginBottom: 12 }}>Delivery Details</Text>
            <InfoRow label="Name" value={`${order.customer_first_name ?? ''} ${order.customer_last_name ?? ''}`.trim()} />
            <InfoRow label="Phone" value={order.customer_phone ?? '—'} />
            <InfoRow label="Email" value={order.customer_email ?? '—'} />
            <InfoRow
              label="Address"
              value={[order.delivery_address, order.delivery_city, order.delivery_state].filter(Boolean).join(', ')}
            />
          </View>

          {/* Items */}
          <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <Text variant="overline" tone="muted" style={{ marginBottom: 12 }}>
              Items ({(order.items as any[])?.length ?? 0})
            </Text>
            {((order.items as any[]) ?? []).map((item: any, i: number) => (
              <TouchableOpacity
                key={i}
                onPress={() => item.slug && router.push(`/product/${item.slug}`)}
                className="flex-row items-center gap-3 py-3 border-b border-gray-50"
                activeOpacity={item.slug ? 0.7 : 1}
              >
                {imageFor(item) ? (
                  <View className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100">
                    <Image source={{ uri: imageFor(item)! }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  </View>
                ) : (
                  <View className="w-14 h-14 rounded-xl bg-gray-100 items-center justify-center">
                    <Ionicons name="bag-outline" size={22} color={Colors.gray[300]} />
                  </View>
                )}
                <View className="flex-1">
                  <Text variant="bodyStrong" numberOfLines={2}>{item.name}</Text>
                  {(item.size || item.color) && (
                    <Text variant="meta" tone="muted" style={{ marginTop: 2 }}>
                      {[item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  <Text variant="meta" tone="muted" style={{ marginTop: 4 }}>Qty: {item.quantity}</Text>
                </View>
                <Text variant="bodyStrong" tone="accent">{formatCurrency(item.price * item.quantity)}</Text>
              </TouchableOpacity>
            ))}

            <View className="flex-row justify-between items-center pt-3">
              <Text variant="bodyStrong">Total</Text>
              <Text variant="price" tone="accent">{formatCurrency(order.final_total)}</Text>
            </View>
          </View>

          <Button
            title="Continue Shopping"
            onPress={() => router.push('/(tabs)/shop')}
            fullWidth
            size="lg"
          />
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row justify-between items-start py-2 border-b border-gray-50">
      <Text variant="body" tone="muted" style={{ flexShrink: 0, marginRight: 16 }}>{label}</Text>
      <Text variant="bodyStrong" tone={highlight ? 'accent' : 'default'} style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}
