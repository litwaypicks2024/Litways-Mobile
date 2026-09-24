import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { color, gutter, spacing } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { alertDialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/Toast';

const MIN_LENGTH = 8;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const tooShort = pw.length > 0 && pw.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSave = pw.length >= MIN_LENGTH && pw === confirm && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      alertDialog("Couldn't update password", error.message);
      return;
    }
    showToast({ title: 'Password updated', tone: 'success' });
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Change password" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: gutter }}>
          <Text variant="bodyLg" tone="body" style={{ marginBottom: spacing.lg }}>
            Choose a new password of at least {MIN_LENGTH} characters.
          </Text>
          <Input
            label="New password"
            isPassword
            leftIcon="lock-closed-outline"
            value={pw}
            onChangeText={setPw}
            error={tooShort ? `Use at least ${MIN_LENGTH} characters` : undefined}
            autoCapitalize="none"
            textContentType="newPassword"
            returnKeyType="next"
          />
          <Input
            label="Confirm new password"
            isPassword
            leftIcon="lock-closed-outline"
            value={confirm}
            onChangeText={setConfirm}
            error={mismatch ? "Passwords don't match" : undefined}
            autoCapitalize="none"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </ScrollView>
        <View
          style={{
            backgroundColor: color.surface,
            borderTopWidth: 1,
            borderTopColor: color.border,
            paddingHorizontal: gutter,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          }}
        >
          <Button title="Update password" onPress={handleSave} loading={saving} disabled={!canSave} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
