import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stats = [
    { value: '10K+', label: 'Customers' },
    { value: '5K+', label: 'Products' },
    { value: '15', label: 'Counties' },
    { value: '99%', label: 'Satisfaction' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-5 pb-4 flex-row items-center gap-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">About Us</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={['#ea580c', '#f97316']} style={{ padding: 32, alignItems: 'center' }}>
          <View className="w-20 h-20 bg-white/20 rounded-2xl items-center justify-center mb-4">
            <Ionicons name="bag" size={40} color="#fff" />
          </View>
          <Text className="text-white text-3xl font-bold mb-2">Litway Picks</Text>
          <Text className="text-white/80 text-sm text-center">Liberia's Premier Online Shopping Destination</Text>
        </LinearGradient>

        {/* Stats */}
        <View className="mx-5 -mt-6 bg-white rounded-2xl p-5 shadow-md">
          <View className="flex-row justify-around">
            {stats.map((s) => (
              <View key={s.label} className="items-center">
                <Text className="text-2xl font-bold text-primary-600">{s.value}</Text>
                <Text className="text-xs text-gray-500 mt-1">{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="px-5 mt-6 gap-4">
          <Section title="Our Story">
            Litway Picks was founded with a simple mission: to make quality shopping accessible to every Liberian, no matter where they live. From Montserrado to Sinoe, we deliver across all 15 counties.
          </Section>
          <Section title="Our Mission">
            We connect Liberians with the products they love — fashion, electronics, home goods, and more — delivered safely and affordably through MTN Mobile Money.
          </Section>
          <Section title="Why Choose Us">
            {[
              'Fast, reliable delivery across all 15 counties',
              'Secure payments via MTN MoMo',
              '7-day return policy',
              '24/7 customer support',
              'Curated, quality-assured products',
            ].map((item) => (
              <View key={item} className="flex-row items-start gap-2 mb-2">
                <Ionicons name="checkmark-circle" size={16} color={Colors.primary[600]} style={{ marginTop: 1 }} />
                <Text className="text-sm text-gray-600 flex-1">{item}</Text>
              </View>
            ))}
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-5 shadow-sm">
      <Text className="text-base font-bold text-gray-900 mb-3">{title}</Text>
      {typeof children === 'string' ? (
        <Text className="text-sm text-gray-600 leading-6">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}
