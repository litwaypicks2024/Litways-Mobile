import React from 'react';
import {
  View,
  Text,
  StatusBar,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { FlashList } from '@/components/ui/List';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { color, radius } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/PressableScale';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import { formatCurrency } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CartItem } from '@/types';

const FREE_SHIPPING_THRESHOLD = 50;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, updateQuantity, removeItem, subtotal, clearCart } = useCartStore();
  const user = useAuthStore((s) => s.user);

  const total = subtotal();
  const shippingProgress = Math.min((total / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - total, 0);
  const freeShipping = remaining === 0;

  function handleCheckout() {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    router.push('/checkout');
  }

  function handleClearAll() {
    Alert.alert('Clear cart?', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  }

  const tabBarClearance = useTabBarClearance();

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <View style={{
          backgroundColor: color.surface,
          paddingHorizontal: 20,
          paddingBottom: 14,
          paddingTop: insets.top + 12,
        }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: color.ink }}>My Cart</Text>
        </View>
        <EmptyState
          icon="bag-outline"
          title="Your cart is empty"
          description="Looks like you haven't added anything yet. Start shopping!"
          actionLabel="Browse Shop"
          onAction={() => router.push('/shop')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={color.surface} />

      {/* ─── Header ─── */}
      <View style={{
        backgroundColor: color.surface,
        paddingHorizontal: 20,
        paddingBottom: 14,
        paddingTop: insets.top + 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: color.ink }}>My Cart</Text>
          <Text style={{ fontSize: 13, color: color.inkMuted, marginTop: 1 }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleClearAll} hitSlop={8}>
          <Text style={{ fontSize: 13, color: color.danger, fontWeight: '600' }}>Clear all</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Free shipping progress ─── */}
      <View style={{ backgroundColor: color.surface, marginBottom: 8, paddingHorizontal: 20, paddingVertical: 12 }}>
        {freeShipping ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, backgroundColor: '#dcfce7', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={16} color="#16a34a" />
            </View>
            <Text style={{ fontSize: 13, color: '#15803d', fontWeight: '700' }}>Free shipping unlocked!</Text>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 12, color: color.inkMuted, marginBottom: 6 }}>
              Add <Text style={{ fontWeight: '800', color: color.accent }}>{formatCurrency(remaining)}</Text> more for{' '}
              <Text style={{ fontWeight: '700', color: '#15803d' }}>FREE shipping</Text>
            </Text>
            <View style={{ height: 6, backgroundColor: color.surfaceSunken, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${shippingProgress}%`, backgroundColor: color.accent, borderRadius: 3 }} />
            </View>
          </View>
        )}
      </View>

      <FlashList
        data={items}
        estimatedItemSize={108}
        keyExtractor={(item) => `${item.productId}::${item.size}::${item.color}`}
        contentContainerStyle={{ padding: 12, paddingBottom: tabBarClearance }}
        renderItem={({ item }) => (
          <CartItemRow item={item} onUpdate={updateQuantity} onRemove={removeItem} />
        )}
        ListFooterComponent={
          <Card style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: color.ink, marginBottom: 14 }}>Order Summary</Text>

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: color.inkMuted }}>
                  Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: color.ink }}>{formatCurrency(total)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: color.inkMuted }}>Shipping</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: freeShipping ? '#16a34a' : color.inkMuted }}>
                  {freeShipping ? 'FREE' : 'Calculated at checkout'}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: color.border, marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: color.ink }}>Total</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: color.accent }}>{formatCurrency(total)}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: color.border }}>
              {[
                { icon: 'shield-checkmark-outline', label: 'Secure\nPayment' },
                { icon: 'refresh-outline', label: 'Easy\nReturns' },
                { icon: 'car-outline', label: 'Fast\nDelivery' },
              ].map((tItem) => (
                <View key={tItem.label} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={tItem.icon as any} size={18} color="#16a34a" />
                  </View>
                  <Text style={{ fontSize: 10, color: color.inkMuted, fontWeight: '600', textAlign: 'center' }}>{tItem.label}</Text>
                </View>
              ))}
            </View>

            <Button
              title={`Checkout · ${formatCurrency(total)}`}
              onPress={handleCheckout}
              variant="primary"
              fullWidth
              size="lg"
              icon={<Ionicons name="lock-closed-outline" size={18} color={color.onAccent} />}
              style={{ marginTop: 20 }}
            />
            <TouchableOpacity onPress={() => router.push('/shop')} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ fontSize: 14, color: color.inkMuted }}>Continue Shopping</Text>
            </TouchableOpacity>
          </Card>
        }
      />
    </View>
  );
}

function CartItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  onUpdate: (id: string, qty: number, size?: string, color?: string) => void;
  onRemove: (id: string, size?: string, color?: string) => void;
}) {
  const router = useRouter();
  return (
    <Card padded={false} style={{ padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12 }}>
      <PressableScale haptic onPress={() => router.push(`/product/${item.slug}`)} style={{ borderRadius: 12, overflow: 'hidden', width: 88, height: 88, backgroundColor: color.surfaceSunken }}>
        <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
      </PressableScale>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
          {item.brand}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: color.ink, lineHeight: 18, marginBottom: 5 }} numberOfLines={2}>
          {item.name}
        </Text>

        {(item.size || item.color) && (
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {item.size && (
              <View style={{ backgroundColor: color.surfaceSunken, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full }}>
                <Text style={{ fontSize: 11, color: color.inkMuted, fontWeight: '600' }}>Size {item.size}</Text>
              </View>
            )}
            {item.color && (
              <View style={{ backgroundColor: color.surfaceSunken, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full }}>
                <Text style={{ fontSize: 11, color: color.inkMuted, fontWeight: '600' }}>{item.color}</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: color.accent }}>
            {formatCurrency(item.price * item.quantity)}
          </Text>
          <QuantityStepper
            quantity={item.quantity}
            max={item.stock}
            onDecrement={() => onUpdate(item.productId, item.quantity - 1, item.size, item.color)}
            onIncrement={() => onUpdate(item.productId, item.quantity + 1, item.size, item.color)}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={() => onRemove(item.productId, item.size, item.color)}
        hitSlop={10}
        style={{ position: 'absolute', top: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={20} color={color.inkFaint} />
      </TouchableOpacity>
    </Card>
  );
}
