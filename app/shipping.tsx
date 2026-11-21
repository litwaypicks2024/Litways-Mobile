import React from 'react';
import { View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { LIBERIAN_COUNTIES } from '@/constants/counties';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { CONTACT_PHONE_DISPLAY, CONTACT_WHATSAPP_URL, openContactUrl } from '@/constants/contact';

export default function ShippingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-5 pb-4 flex-row items-center gap-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text variant="heading">Shipping Info</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="bg-primary-50 rounded-2xl p-5 mb-5 flex-row items-start gap-3">
          <Ionicons name="car" size={24} color={Colors.primary[600]} />
          <View className="flex-1">
            <Text variant="heading" tone="accent" style={{ marginBottom: 4 }}>Nationwide Delivery</Text>
            <Text variant="body" tone="accent">We deliver to all 15 Liberian counties. Delivery fees are calculated at checkout based on your location.</Text>
          </View>
        </View>
        {[
          { icon: 'time-outline', title: 'Delivery Timeline', body: 'Montserrado: within 24 hours\nAll other counties: 2–7 business days' },
          { icon: 'shield-checkmark-outline', title: 'Order Tracking', body: 'You\'ll receive an email confirmation with your order details once payment is confirmed.' },
          { icon: 'call-outline', title: 'Delivery Support', body: `Having trouble with a delivery? Contact us via WhatsApp at ${CONTACT_PHONE_DISPLAY}.`, url: CONTACT_WHATSAPP_URL, cta: 'Chat on WhatsApp' },
        ].map((item: { icon: string; title: string; body: string; url?: string; cta?: string }) => (
          <TouchableOpacity
            key={item.title}
            disabled={!item.url}
            onPress={() => item.url && openContactUrl(item.url)}
            accessibilityRole={item.url ? 'link' : undefined}
            className="bg-white rounded-2xl p-5 shadow-sm mb-4"
          >
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name={item.icon as any} size={20} color={Colors.primary[600]} />
              <Text variant="heading">{item.title}</Text>
            </View>
            <Text variant="bodyLg" tone="body">{item.body}</Text>
            {item.cta && (
              <View className="flex-row items-center gap-1.5 mt-3">
                <Ionicons name="logo-whatsapp" size={16} color={Colors.primary[600]} />
                <Text variant="bodyStrong" tone="accent">{item.cta}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text variant="heading" style={{ marginBottom: 12 }}>Coverage — All 15 Counties</Text>
          <View className="flex-row flex-wrap gap-2">
            {LIBERIAN_COUNTIES.map((county) => (
              <View key={county} className="bg-primary-50 px-3 py-1.5 rounded-full">
                <Text variant="metaStrong" tone="accent">{county}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
