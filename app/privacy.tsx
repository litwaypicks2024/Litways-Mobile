import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const sections = [
  { title: 'Information We Collect', body: 'We collect information you provide directly: name, email, phone number, delivery address, and payment details. We also collect usage data to improve your experience.' },
  { title: 'How We Use Your Information', body: 'Your information is used to process orders, send confirmations, deliver products, improve our services, and communicate offers (with your consent).' },
  { title: 'Data Security', body: 'We use industry-standard encryption and security measures. Payment data is processed securely via MTN Mobile Money and is never stored on our servers.' },
  { title: 'Your Rights', body: 'You have the right to access, correct, or delete your personal data at any time. Contact us at litwaypicks@gmail.com to exercise these rights.' },
  { title: 'Third-Party Services', body: 'We use Supabase for data storage and MTN MoMo for payments. These services have their own privacy policies.' },
  { title: 'Contact Us', body: 'Questions about privacy? Email us at litwaypicks@gmail.com.' },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-5 pb-4 flex-row items-center gap-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={22} color={Colors.gray[800]} /></TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Privacy Policy</Text>
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
