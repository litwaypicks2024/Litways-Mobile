import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { isValidLiberianMobile } from '@/lib/phone';
import { color, gutter, spacing } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { alertDialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/Toast';

/**
 * Edit personal details on their own screen (back arrow, grouped fields, a
 * Save bar pinned to the bottom) instead of unlocking fields in place on the
 * account card. Save stays disabled until something actually changed and the
 * required bits are valid; leaving with unsaved edits asks first.
 */

type Form = { first_name: string; last_name: string; phone: string; address: string; city: string };

const fromProfile = (p: ReturnType<typeof useAuthStore.getState>['profile']): Form => ({
  first_name: p?.first_name ?? '',
  last_name: p?.last_name ?? '',
  phone: p?.phone ?? '',
  address: p?.address ?? '',
  city: p?.city ?? '',
});

export default function EditProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const original = useMemo(() => fromProfile(profile), [profile]);
  const [form, setForm] = useState<Form>(original);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const allowLeave = useRef(false);

  // Profile can arrive after mount (cold start): adopt it until the shopper starts typing.
  useEffect(() => {
    if (!touched) setForm(original);
  }, [original, touched]);

  const trimmed: Form = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
  };
  const dirty = (Object.keys(trimmed) as (keyof Form)[]).some((k) => trimmed[k] !== original[k].trim());

  const errors = {
    first_name: touched && !trimmed.first_name ? 'Enter your first name' : undefined,
    phone: trimmed.phone && !isValidLiberianMobile(trimmed.phone) ? 'Enter a valid Liberian mobile number' : undefined,
  };
  const canSave = dirty && !!trimmed.first_name && !errors.phone && !saving;

  function set<K extends keyof Form>(key: K, value: string) {
    setTouched(true);
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Ask before throwing away edits (back button, swipe, Android back).
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeave.current || !dirty || saving) return;
      e.preventDefault();
      alertDialog('Discard changes?', 'Your edits to your details will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation, dirty, saving]);

  async function handleSave() {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      // .select() so we can tell when nothing was written: an UPDATE that matches
      // no row (RLS filtered it, or the profile row is missing) returns no error.
      const { data, error } = await supabase.from('users').update(trimmed).eq('id', user.id).select('id');
      if (error) {
        alertDialog("Couldn't save changes", error.message);
        return;
      }
      if (!data?.length) {
        alertDialog("Couldn't save changes", "We couldn't find your profile to update. Please sign out and back in, then try again.");
        return;
      }
      await fetchProfile(user.id);
      allowLeave.current = true;
      showToast({ title: 'Profile updated', tone: 'success' });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Personal details" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: gutter, paddingBottom: spacing['2xl'] }}
        >
          <Section title="Your name">
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Input
                  label="First name"
                  value={form.first_name}
                  onChangeText={(v) => set('first_name', v)}
                  error={errors.first_name}
                  autoCapitalize="words"
                  textContentType="givenName"
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Input
                  label="Last name"
                  value={form.last_name}
                  onChangeText={(v) => set('last_name', v)}
                  autoCapitalize="words"
                  textContentType="familyName"
                  returnKeyType="next"
                />
              </View>
            </View>
          </Section>

          <Section title="Contact" note="Your email is your sign-in and can't be changed here.">
            <Input
              label="Phone"
              leftIcon="call-outline"
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              error={errors.phone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              placeholder="e.g. 0881 234 567"
            />
            <Input
              label="Email"
              leftIcon="mail-outline"
              rightIcon="lock-closed-outline"
              value={user?.email ?? ''}
              editable={false}
              containerStyle={{ backgroundColor: color.surfaceSunken }}
            />
          </Section>

          <Section title="Delivery address" note="We'll prefill these at checkout so ordering takes seconds.">
            <Input
              label="Address"
              leftIcon="location-outline"
              value={form.address}
              onChangeText={(v) => set('address', v)}
              textContentType="streetAddressLine1"
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="City"
              leftIcon="business-outline"
              value={form.city}
              onChangeText={(v) => set('city', v)}
              textContentType="addressCity"
              autoCapitalize="words"
              returnKeyType="done"
            />
          </Section>
        </ScrollView>

        {/* Pinned Save bar */}
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
          <Button title="Save changes" onPress={handleSave} loading={saving} disabled={!canSave} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Owns the vertical rhythm: title, 12 → fields, note 8 below, 24 → next section.
 * Every Input carries a 16px bottom margin, so the field group cancels the last
 * one; otherwise it stacks with the section gap and the spacing drifts.
 */
function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text variant="heading" style={{ marginBottom: spacing.md }}>{title}</Text>
      <View style={{ marginBottom: -16 }}>{children}</View>
      {!!note && <Text variant="meta" tone="muted" style={{ marginTop: spacing.sm }}>{note}</Text>}
    </View>
  );
}
