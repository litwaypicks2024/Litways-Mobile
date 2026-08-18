import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { color } from '@/theme/tokens';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { InkHeader } from '@/components/auth/InkHeader';
import { BrokenLinkIllustration } from '@/components/illustrations';

// Extract key=value pairs from BOTH the query string and the hash fragment of a
// deep link. Implicit-flow recovery links (our default) put tokens after '#',
// which Linking.parse() does not decode — hence the manual pass.
function getAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const idx = url.search(/[?#]/);
  if (idx === -1) return out;
  const raw = url.slice(idx + 1).replace(/[?#]/g, '&');
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const val = eq === -1 ? '' : pair.slice(eq + 1);
    if (key) out[decodeURIComponent(key)] = decodeURIComponent(val);
  }
  return out;
}

// Establishes a short-lived recovery session from the reset link so the user can
// set a new password. Handles implicit (access_token/refresh_token) and PKCE (code).
async function establishRecoverySession(url: string): Promise<boolean> {
  const p = getAuthParams(url);
  try {
    if (p.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(p.code);
      return !error;
    }
    if (p.access_token && p.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: p.access_token,
        refresh_token: p.refresh_token,
      });
      return !error;
    }
  } catch {
    return false;
  }
  return false;
}

type Phase = 'verifying' | 'ready' | 'invalid';

export default function NewPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const incomingUrl = Linking.useURL();

  const [phase, setPhase] = useState<Phase>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = incomingUrl ?? (await Linking.getInitialURL());
      if (url && (await establishRecoverySession(url))) {
        if (!cancelled) setPhase('ready');
        return;
      }
      // The client may have already established a recovery session on its own.
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setPhase(data.session ? 'ready' : 'invalid');
    })();
    return () => {
      cancelled = true;
    };
  }, [incomingUrl]);

  async function handleUpdate() {
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please re-enter the same password.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      Alert.alert('Could not update password', error.message);
      return;
    }
    Alert.alert('Password updated', 'You can now sign in with your new password.', [
      {
        text: 'OK',
        onPress: async () => {
          // End the recovery session so the user signs in fresh.
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <InkHeader
            icon="arrow-back"
            onIconPress={() => router.replace('/(auth)/login')}
            title={'New\npassword.'}
            subtitle="Choose a new password for your account"
          />

          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: Math.max(insets.bottom + 24, 40),
            }}
          >
            {phase === 'verifying' && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <ActivityIndicator color={color.accent} />
                <Text style={{ fontSize: 14, color: color.inkMuted }}>Verifying your reset link…</Text>
              </View>
            )}

            {phase === 'invalid' && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 8 }}>
                <BrokenLinkIllustration />
                <Text style={{ fontSize: 18, fontWeight: '800', color: color.ink, textAlign: 'center' }}>
                  Reset link invalid or expired
                </Text>
                <Text style={{ fontSize: 14, color: color.inkMuted, textAlign: 'center', lineHeight: 20 }}>
                  Please request a new password reset email and open the link from this device.
                </Text>
                <Button
                  title="Request New Link"
                  onPress={() => router.replace('/(auth)/reset-password')}
                  style={{ marginTop: 8 }}
                />
              </View>
            )}

            {phase === 'ready' && (
              <View>
                <Input
                  label="New Password"
                  leftIcon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                  placeholder="Minimum 8 characters"
                  returnKeyType="next"
                />
                <Input
                  label="Confirm Password"
                  leftIcon="lock-closed-outline"
                  value={confirm}
                  onChangeText={setConfirm}
                  isPassword
                  placeholder="Re-enter password"
                  returnKeyType="done"
                  onSubmitEditing={handleUpdate}
                />

                <Button
                  title="Update Password"
                  onPress={handleUpdate}
                  loading={saving}
                  fullWidth
                  size="lg"
                  style={{ marginTop: 8 }}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
