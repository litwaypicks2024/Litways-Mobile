import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { color } from '@/theme/tokens';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { InkHeader } from '@/components/auth/InkHeader';
import { alertDialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';

// Same allowlist as login.tsx — `next` is a caller-supplied route param.
const CONFIRMATION_NEXT = /^\/confirmation\?referenceId=[A-Za-z0-9_-]{6,64}$/;

/**
 * Step two of sign-up: the customer types the 6-digit code Supabase emailed
 * them. This proves they own the address before the account can be used, so
 * nobody can register with someone else's email.
 */
export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email, next } = useLocalSearchParams<{ email?: string; next?: string }>();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  function leave() {
    // login.tsx replaced itself with this screen, so back() lands on whatever
    // opened sign-in (e.g. the in-progress checkout) — same as a normal sign-in.
    if (next && CONFIRMATION_NEXT.test(next)) router.replace(next as any);
    else router.back();
  }

  async function handleVerify() {
    const token = code.replace(/\D/g, '');
    if (!email) { alertDialog('Something went wrong', 'Please sign up again.'); return; }
    if (token.length !== 6) { alertDialog('Enter your code', 'Type the 6-digit code from your email.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setLoading(false);
    if (error) {
      alertDialog('Invalid code', 'That code is invalid or has expired. Request a new one below.');
      return;
    }
    alertDialog('Email verified!', 'Welcome to Litway Picks — your account is ready.');
    leave();
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) { alertDialog("Couldn't resend", error.message); return; }
    alertDialog('Code sent', `A new code is on its way to ${email}.`);
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
            title={'Verify\nyour email.'}
            subtitle="One quick step to secure your account"
          />

          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: Math.max(insets.bottom + 24, 40),
            }}
          >
            <Text variant="body" tone="muted" style={{ marginBottom: 24 }}>
              We sent a 6-digit code to{' '}
              <Text weight="bold" tone="default">{email}</Text>
              . Enter it below to confirm this email belongs to you.
            </Text>

            <Input
              label="Verification code"
              leftIcon="keypad-outline"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleVerify}
            />

            <Button
              title="Verify Email"
              onPress={handleVerify}
              loading={loading}
              disabled={code.length !== 6}
              fullWidth
              size="lg"
              icon={<Ionicons name="checkmark-circle-outline" size={18} color={color.onAccent} />}
              style={{ marginTop: 8 }}
            />

            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              accessibilityRole="button"
              style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }}
            >
              <Text variant="body" tone="muted">
                Didn't get it? Check spam, or{' '}
                <Text weight="semibold" tone="accent">
                  {resending ? 'sending…' : 'send a new code'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
