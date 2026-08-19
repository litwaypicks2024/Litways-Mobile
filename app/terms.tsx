import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const sections = [
  { title: 'Acceptance of Terms', body: 'By using Litway Picks, you agree to these terms. If you disagree, please do not use our service.' },
  { title: 'Products & Pricing', body: 'We reserve the right to modify prices at any time. Products are subject to availability. In the event of a pricing error, we will contact you before processing your order.' },
  { title: 'Orders & Payment', body: 'Orders are confirmed only after successful payment via MTN Mobile Money. We reserve the right to cancel orders if payment is not received or if stock is unavailable.' },
  { title: 'Delivery', body: 'Delivery times are estimates. Litway Picks is not responsible for delays beyond our control. Risk of damage passes to you upon delivery.' },
  { title: 'Returns & Refunds', body: 'Returns accepted within 7 days of delivery for unused items in original condition. Refunds processed within 3–5 business days after return confirmation.' },
  { title: 'Limitation of Liability', body: 'Litway Picks is not liable for indirect, incidental, or consequential damages arising from use of our service.' },
  { title: 'Governing Law', body: 'These terms are governed by the laws of the Republic of Liberia.' },
];

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-5 pb-4 flex-row items-center gap-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={22} color={Colors.gray[800]} /></TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Terms & Conditions</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="text-xs text-gray-400 mb-5">Last updated: May 2026</Text>
        <View className="gap-4">
          {sections.map((s) => (
            <View key={s.title} className="bg-white rounded-2xl p-5 shadow-sm">
              <Text className="text-base font-bold text-gray-900 mb-2">{s.title}</Text>
              <Text className="text-sm text-gray-600 leading-6">{s.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
