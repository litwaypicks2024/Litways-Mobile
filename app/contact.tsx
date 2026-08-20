import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { submitContactForm } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ContactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!form.name || !form.email || !form.message) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      await submitContactForm(form);
      Alert.alert('Message Sent!', "We'll get back to you within 24 hours.");
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const contacts = [
    { icon: 'mail-outline', label: 'Email', value: 'litwaypicks@gmail.com' },
    { icon: 'logo-whatsapp', label: 'WhatsApp', value: '+231 888 640 502' },
    { icon: 'time-outline', label: 'Hours', value: 'Mon–Sat, 8am–6pm' },
  ];

  const faqs = [
    { q: 'How long does delivery take?', a: 'Delivery typically takes 1–3 business days depending on your county.' },
    { q: 'What payment methods do you accept?', a: 'We currently accept MTN Mobile Money (MoMo).' },
    { q: 'Can I return an item?', a: 'Yes! We have a 7-day return policy for unused items in original condition.' },
    { q: 'Do you deliver to all counties?', a: 'Yes, we deliver to all 15 Liberian counties.' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-5 pb-4 flex-row items-center gap-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Contact Us</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Contact info */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-5">
          {contacts.map((c, i) => (
            <View key={c.label} className={`flex-row items-center gap-3 ${i < contacts.length - 1 ? 'mb-4' : ''}`}>
              <View className="w-10 h-10 bg-primary-50 rounded-full items-center justify-center">
                <Ionicons name={c.icon as any} size={18} color={Colors.primary[600]} />
              </View>
              <View>
                <Text className="text-xs text-gray-400 font-medium">{c.label}</Text>
                <Text className="text-sm font-semibold text-gray-800">{c.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Contact form */}
        <Text className="text-base font-bold text-gray-900 mb-4">Send a Message</Text>
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-5">
          <Input label="Name *" leftIcon="person-outline" value={form.name} onChangeText={(v) => setForm((s) => ({ ...s, name: v }))} />
          <Input label="Email *" leftIcon="mail-outline" value={form.email} onChangeText={(v) => setForm((s) => ({ ...s, email: v }))} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Subject" leftIcon="chatbubble-outline" value={form.subject} onChangeText={(v) => setForm((s) => ({ ...s, subject: v }))} />
          <Input label="Message *" leftIcon="create-outline" value={form.message} onChangeText={(v) => setForm((s) => ({ ...s, message: v }))} multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top' }} />
          <Button title="Send Message" onPress={handleSubmit} loading={loading} fullWidth size="lg" style={{ marginTop: 4 }} />
        </View>

        {/* FAQs */}
        <Text className="text-base font-bold text-gray-900 mb-4">Frequently Asked Questions</Text>
        <View className="gap-3">
          {faqs.map((faq) => (
            <View key={faq.q} className="bg-white rounded-2xl p-4 shadow-sm">
              <View className="flex-row gap-2 mb-2">
                <Ionicons name="help-circle" size={18} color={Colors.primary[600]} style={{ marginTop: 1 }} />
                <Text className="text-sm font-semibold text-gray-900 flex-1">{faq.q}</Text>
              </View>
              <Text className="text-sm text-gray-600 leading-5 ml-6">{faq.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
