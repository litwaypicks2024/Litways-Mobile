import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { momoAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, shadow } from '@/theme/tokens';
import { Card } from '@/components/ui/Card';

export default function ConfirmationScreen() {
  const { referenceId } = useLocalSearchParams<{ referenceId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!referenceId) return;
    momoAPI.getOrder(referenceId).then((data) => {
      setOrder(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [referenceId]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: insets.top + 32, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View
            style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: color.surface,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              ...shadow.card,
            }}
          >
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={40} color={color.onAccent} />
            </View>
          </View>
          <Text style={{ fontSize: 22, fontFamily: font.displayHeavy, color: color.ink }}>Thank You!</Text>
          <Text style={{ fontSize: 17, fontFamily: font.display, color: color.accent, marginTop: 2 }}>Your Order is Confirmed</Text>
          <Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
            We received your order and it's now being processed.
          </Text>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator color={color.accent} />
            <Text style={{ fontSize: 13, color: color.inkMuted, marginTop: 12 }}>Loading order details...</Text>
          </View>
        ) : order ? (
          <>
            <View style={{ backgroundColor: color.peachTint, borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="document-text-outline" size={22} color={color.accentPressed} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: color.accentPressed, fontWeight: '700', marginBottom: 2 }}>ORDER ID</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: color.ink }}>{order.external_id}</Text>
              </View>
            </View>

            <Card style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Order Details
              </Text>
              <View style={{ gap: 10 }}>
                <Row label="Status" value={order.payment_status} highlight />
                <Row label="Total Paid" value={formatCurrency(order.final_total)} highlight />
              </View>
            </Card>

            <Card style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Delivery
              </Text>
              <View style={{ gap: 10 }}>
                <Row label="Name" value={`${order.customer_first_name} ${order.customer_last_name}`} />
                <Row label="Email" value={order.customer_email} />
                <Row label="Phone" value={order.customer_phone} />
                <Row label="Address" value={`${order.delivery_address}, ${order.delivery_city}, ${order.delivery_state}`} />
              </View>
            </Card>

            <Card style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Items
              </Text>
              {(order.items as any[])?.map((item: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border }}>
                  <Text style={{ fontSize: 13, color: color.ink, flex: 1 }} numberOfLines={1}>
                    {item.name} {item.size ? `(${item.size})` : ''} × {item.quantity}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: color.accent, marginLeft: 8 }}>
                    {formatCurrency(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : (
          <View style={{ backgroundColor: color.peachTint, borderRadius: 20, padding: 16, marginBottom: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: color.accentPressed, textAlign: 'center', fontWeight: '600' }}>
              Your order has been placed! Reference:{'\n'}{referenceId}
            </Text>
          </View>
        )}

        <Button title="Track Your Order" onPress={() => router.replace('/(tabs)/account')} variant="primary" fullWidth size="lg" />
        <Button title="Continue Shopping" variant="outline" onPress={() => router.replace('/(tabs)')} fullWidth size="md" style={{ marginTop: 12 }} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: color.inkMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: highlight ? color.accent : color.ink }}>{value}</Text>
    </View>
  );
}
