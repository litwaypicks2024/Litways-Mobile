import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { color, font } from '@/theme/tokens';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { InkHeader } from '@/components/auth/InkHeader';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email) { Alert.alert('Enter your email address'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'litwaypicks://new-password',
    });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setSent(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          bounces={false}
        >
          <InkHeader
            icon="arrow-back"
            onIconPress={() => router.back()}
            iconAccessibilityLabel="Go back"
            title={'Reset\npassword.'}
            subtitle="We'll send a secure link to your email"
          />

          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: Math.max(insets.bottom + 24, 40),
            }}
          >
            {sent ? (
              /* ─── Success state ─── */
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    backgroundColor: color.accentSoft,
                    borderRadius: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                  }}
                >
                  <Ionicons name="mail-outline" size={38} color={color.accent} />
                </View>
                <Text style={{ fontSize: 22, fontFamily: font.display, color: color.ink, marginBottom: 8, textAlign: 'center' }}>
                  Check your inbox
                </Text>
                <Text style={{ fontSize: 14, color: color.inkMuted, textAlign: 'center', lineHeight: 21, marginBottom: 32 }}>
                  We sent a reset link to{'\n'}
                  <Text style={{ fontWeight: '700', color: color.ink }}>{email}</Text>
                </Text>
                <Button
                  title="Back to Sign In"
                  onPress={() => router.back()}
                  fullWidth
                  size="lg"
                  icon={<Ionicons name="arrow-back" size={18} color={color.onAccent} />}
                />
                <Text style={{ fontSize: 12, color: color.inkFaint, marginTop: 16, textAlign: 'center' }}>
                  Didn't get it? Check your spam folder or try again.
                </Text>
              </View>
            ) : (
              /* ─── Form state ─── */
              <>
                <Text style={{ fontSize: 14, color: color.inkMuted, lineHeight: 21, marginBottom: 24 }}>
                  No worries — enter your email and we'll send you a link to get back in.
                </Text>

                <Input
                  label="Email Address"
                  leftIcon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="send"
                  onSubmitEditing={handleReset}
                />

                <Button
                  title="Send Reset Link"
                  onPress={handleReset}
                  loading={loading}
                  fullWidth
                  size="lg"
                  icon={<Ionicons name="send-outline" size={18} color={color.onAccent} />}
                  style={{ marginTop: 8 }}
                />

                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }}
                >
                  <Text style={{ fontSize: 14, color: color.inkMuted, fontWeight: '500' }}>
                    ← Back to Sign In
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
