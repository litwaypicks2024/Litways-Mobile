import React from 'react';
import {
  View,
  Text,
  StatusBar,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@/components/ui/List';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { color, font, radius } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmptyBagIllustration } from '@/components/illustrations';
import { PressableScale } from '@/components/ui/PressableScale';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import { formatCurrency } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CartItem } from '@/types';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const total = useCartStore((s) => s.subtotal());
  const itemQuantity = items.reduce((s, i) => s + i.quantity, 0);
  const mergeNotice = useCartStore((s) => s.mergeNotice);
  const dismissMergeNotice = useCartStore((s) => s.dismissMergeNotice);
  const syncFailed = useCartStore((s) => s.syncFailed);
  const retrySync = useCartStore((s) => s.retrySync);
  const syncing = useCartStore((s) => s.syncing);
  const syncNotice = useCartStore((s) => s.syncNotice);
  const dismissSyncNotice = useCartStore((s) => s.dismissSyncNotice);
  const manualSync = useCartStore((s) => s.manualSync);
  const userId = useAuthStore((s) => s.user?.id);

  function handleRetrySync() {
    if (userId) void retrySync(userId);
  }

  function handleManualSync() {
    if (userId) void manualSync(userId);
  }

  function handleCheckout() {
    // Checkout gates the payment step itself (sign-in is required to place an
    // order, with everything typed preserved across the sign-in round-trip) —
    // so no login wall here: let shoppers review delivery details first.
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 20, fontFamily: font.display, color: color.ink }}>My Cart</Text>
          {/* An empty local cart is the MOST important sync case — items added
              on the web are waiting on the server — so the control must exist
              here too, not only in the non-empty header. */}
          {userId && (
            <TouchableOpacity
              onPress={handleManualSync}
              disabled={syncing}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sync cart"
              style={{ opacity: syncing ? 0.5 : 1 }}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={color.inkMuted} />
              ) : (
                <Ionicons name="sync-outline" size={20} color={color.inkMuted} />
              )}
            </TouchableOpacity>
          )}
        </View>
        {syncNotice && (
          <View style={{
            marginHorizontal: 16, marginTop: 12, padding: 12,
            backgroundColor: color.accentSoft, borderRadius: radius.lg,
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <Ionicons name="information-circle" size={18} color={color.accent} />
            <Text style={{ flex: 1, fontSize: 13, color: color.ink }}>{syncNotice}</Text>
            <TouchableOpacity onPress={dismissSyncNotice} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
              <Ionicons name="close" size={16} color={color.accentPressed} />
            </TouchableOpacity>
          </View>
        )}
        <EmptyState
          illustration={<EmptyBagIllustration />}
          title="Your cart is empty"
          description={userId
            ? "Nothing here yet. Added items on the website? Tap sync to bring them over."
            : "Looks like you haven't added anything yet. Start shopping!"}
          actionLabel={userId ? 'Sync from my other devices' : 'Browse Shop'}
          onAction={userId ? handleManualSync : () => router.push('/shop')}
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
          <Text style={{ fontSize: 20, fontFamily: font.display, color: color.ink }}>My Cart</Text>
          <Text style={{ fontSize: 13, color: color.inkMuted, marginTop: 1 }}>
            {/* Total quantity, not line-item count — matches the Order Summary's basis below. */}
            {itemQuantity} {itemQuantity === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          {userId && (
            <TouchableOpacity
              onPress={handleManualSync}
              disabled={syncing}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sync cart"
              style={{ opacity: syncing ? 0.5 : 1 }}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={color.inkMuted} />
              ) : (
                <Ionicons name="sync-outline" size={20} color={color.inkMuted} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleClearAll} hitSlop={8}>
            <Text style={{ fontSize: 13, color: color.danger, fontWeight: '600' }}>Clear all</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* syncNotice (manual sync outcome) takes this slot over mergeNotice
          when both would otherwise apply, so the two banners never stack. */}
      {syncNotice ? (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: color.accentSoft,
          marginHorizontal: 12,
          marginTop: 12,
          padding: 12,
          borderRadius: radius.md,
        }}>
          <Ionicons name="information-circle" size={18} color={color.accent} />
          <Text style={{ flex: 1, fontSize: 12.5, color: color.accentPressed, fontWeight: '600' }}>
            {syncNotice}
          </Text>
          <TouchableOpacity onPress={dismissSyncNotice} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Ionicons name="close" size={16} color={color.accentPressed} />
          </TouchableOpacity>
        </View>
      ) : mergeNotice && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: color.accentSoft,
          marginHorizontal: 12,
          marginTop: 12,
          padding: 12,
          borderRadius: radius.md,
        }}>
          <Ionicons name="information-circle" size={18} color={color.accent} />
          <Text style={{ flex: 1, fontSize: 12.5, color: color.accentPressed, fontWeight: '600' }}>
            We combined this cart with items saved to your account.
          </Text>
          <TouchableOpacity onPress={dismissMergeNotice} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Ionicons name="close" size={16} color={color.accentPressed} />
          </TouchableOpacity>
        </View>
      )}

      {/* Non-blocking: syncToDb + its one automatic retry both failed. Local
          cart state is intact — this only means the server copy is behind. */}
      {syncFailed && userId && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: color.surfaceMuted,
          marginHorizontal: 12,
          marginTop: 12,
          padding: 12,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.border,
        }}>
          <Ionicons name="cloud-offline-outline" size={18} color={color.inkMuted} />
          <Text style={{ flex: 1, fontSize: 12.5, color: color.inkMuted, fontWeight: '600' }}>
            Cart changes are saved on this phone but not to your account yet.
          </Text>
          <TouchableOpacity onPress={handleRetrySync} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry sync">
            <Text style={{ fontSize: 12.5, color: color.accent, fontWeight: '800' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

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
            <Text style={{ fontSize: 15, fontFamily: font.display, color: color.ink, marginBottom: 14 }}>Order Summary</Text>

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: color.inkMuted }}>
                  Subtotal ({itemQuantity} items)
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: color.ink }}>{formatCurrency(total)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: color.border, marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: color.ink }}>Total</Text>
                <Text style={{ fontSize: 16, fontFamily: font.displayHeavy, color: color.accent }}>{formatCurrency(total)}</Text>
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

const CartItemRow = React.memo(function CartItemRow({
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
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          recyclingKey={`${item.productId}::${item.size ?? ''}::${item.color ?? ''}`}
        />
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
          <Text style={{ fontSize: 15, fontFamily: font.displayHeavy, color: color.accent }}>
            {formatCurrency(item.price * item.quantity)}
          </Text>
          <QuantityStepper
            quantity={item.quantity}
            max={item.stock}
            onDecrement={() => {
              if (item.quantity === 1) {
                Alert.alert('Remove item?', `Remove "${item.name}" from your cart?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => onUpdate(item.productId, 0, item.size, item.color),
                  },
                ]);
                return;
              }
              onUpdate(item.productId, item.quantity - 1, item.size, item.color);
            }}
            onIncrement={() => onUpdate(item.productId, item.quantity + 1, item.size, item.color)}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={() => onRemove(item.productId, item.size, item.color)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name} from cart`}
        style={{ position: 'absolute', top: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={20} color={color.inkFaint} />
      </TouchableOpacity>
    </Card>
  );
});
