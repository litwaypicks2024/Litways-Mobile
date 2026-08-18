import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { LIBERIAN_COUNTIES } from '@/constants/counties';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ShippingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-5 pb-4 flex-row items-center gap-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Shipping Info</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="bg-primary-50 rounded-2xl p-5 mb-5 flex-row items-start gap-3">
          <Ionicons name="car" size={24} color={Colors.primary[600]} />
          <View className="flex-1">
            <Text className="text-base font-bold text-primary-800 mb-1">Free Delivery Available</Text>
            <Text className="text-sm text-primary-700 leading-5">We deliver to all 15 Liberian counties. Spend $50+ for free shipping on your order.</Text>
          </View>
        </View>
        {[
          { icon: 'time-outline', title: 'Delivery Timeline', body: 'Monrovia & Margibi: 1–2 business days\nOther counties: 2–4 business days' },
          { icon: 'shield-checkmark-outline', title: 'Order Tracking', body: 'You\'ll receive an email confirmation with your order details once payment is confirmed.' },
          { icon: 'call-outline', title: 'Delivery Support', body: 'Having trouble with a delivery? Contact us via WhatsApp at +231 888 640 502.' },
        ].map((item) => (
          <View key={item.title} className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name={item.icon as any} size={20} color={Colors.primary[600]} />
              <Text className="text-base font-bold text-gray-900">{item.title}</Text>
            </View>
            <Text className="text-sm text-gray-600 leading-6">{item.body}</Text>
          </View>
        ))}
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-base font-bold text-gray-900 mb-3">Coverage — All 15 Counties</Text>
          <View className="flex-row flex-wrap gap-2">
            {LIBERIAN_COUNTIES.map((county) => (
              <View key={county} className="bg-primary-50 px-3 py-1.5 rounded-full">
                <Text className="text-xs font-medium text-primary-700">{county}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
