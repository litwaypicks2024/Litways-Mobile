import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReturnsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const steps = ['Contact our support team within 7 days of delivery', 'Provide your order ID and reason for return', 'We\'ll arrange a pickup from your location', 'Refund processed within 3–5 business days'];
  const conditions = ['Item is unused and in original condition', 'Original packaging is intact', 'Item is not in the non-returnable category', 'Return is initiated within 7 days of delivery'];
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-5 pb-4 flex-row items-center gap-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Returns Policy</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <View className="w-14 h-14 bg-primary-50 rounded-2xl items-center justify-center mb-3">
            <Ionicons name="refresh" size={28} color={Colors.primary[600]} />
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-2">7-Day Return Policy</Text>
          <Text className="text-sm text-gray-600 leading-6">Not satisfied? We make returns simple and hassle-free. Return eligible items within 7 days of delivery.</Text>
        </View>
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <Text className="text-base font-bold text-gray-900 mb-3">Return Process</Text>
          {steps.map((step, i) => (
            <View key={i} className="flex-row gap-3 mb-3">
              <View className="w-6 h-6 bg-primary-600 rounded-full items-center justify-center flex-shrink-0">
                <Text className="text-white text-xs font-bold">{i + 1}</Text>
              </View>
              <Text className="text-sm text-gray-600 flex-1 leading-5">{step}</Text>
            </View>
          ))}
        </View>
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-base font-bold text-gray-900 mb-3">Return Conditions</Text>
          {conditions.map((c) => (
            <View key={c} className="flex-row items-start gap-2 mb-2">
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary[600]} style={{ marginTop: 1 }} />
              <Text className="text-sm text-gray-600 flex-1 leading-5">{c}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
