import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  TextInput,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { color, radius, shadow, type as t } from '@/theme/tokens';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LogoMark } from '@/components/brand/LogoMark';
import { alertDialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import { friendlyError } from '@/lib/friendlyError';

type Mode = 'login' | 'signup';

const HERO_H = Math.round(Dimensions.get('window').height * 0.4);

// Security: `next` is a caller-supplied route param — validate it against an
// allowlist rather than navigating to it blindly. The confirmation form is
// pattern-matched because it carries a referenceId query (see confirmation.tsx's
// sign-in hero); the id charset mirrors _layout.tsx's REFERENCE_ID_PATTERN.
const NEXT_ALLOWLIST = ['/checkout'];
const CONFIRMATION_NEXT = /^\/confirmation\?referenceId=[A-Za-z0-9_-]{6,64}$/;

function isAllowedNext(next: string | undefined): next is string {
  return !!next && (NEXT_ALLOWLIST.includes(next) || CONFIRMATION_NEXT.test(next));
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { next, mode: modeParam } = useLocalSearchParams<{ next?: string; mode?: string }>();

  function navigateAfterAuth() {
    if (next === '/checkout') {
      // checkout.tsx's own sign-in card pushed this screen (see next=/checkout
      // there), so the in-progress checkout instance — with whatever the
      // shopper had already typed — is directly beneath us. A replace() would
      // mount a brand-new checkout and lose all of that; going back to the
      // existing one re-triggers its [user, profile] backfill effect instead.
      router.back();
    } else if (isAllowedNext(next)) {
      router.replace(next as any);
    } else {
      router.back();
    }
  }

  const [mode, setMode] = useState<Mode>(modeParam === 'signup' ? 'signup' : 'login');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  useEffect(() => {
    async function checkBiometrics() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
    }
    checkBiometrics();
  }, []);

  async function handleBiometricAuth() {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Litway Picks',
      fallbackLabel: 'Use password instead',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (result.success) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigateAfterAuth();
      else alertDialog('Please sign in again', 'For your security, sign in with your email and password.');
      return;
    }
    // User-initiated cancels are a platform convention — no alert needed.
    if (
      result.error === 'user_cancel' ||
      result.error === 'system_cancel' ||
      result.error === 'app_cancel'
    ) {
      return;
    }
    alertDialog("Couldn't verify", 'Please sign in with your email and password.');
  }

  async function handleAuth() {
    if (!email || !password) {
      alertDialog('Enter your email and password', 'Both are needed to continue.');
      return;
    }
    setLoading(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (error && /email not confirmed/i.test(error.message)) {
        // Signed up earlier but never entered the code — send a fresh one.
        await supabase.auth.resend({ type: 'signup', email: email.trim() });
        goToVerify(email.trim());
        return;
      }
      if (error) { alertDialog("Couldn't sign you in", friendlyError(error, "We couldn't sign you in. Please try again.")); return; }
      navigateAfterAuth();
    } else {
      if (!firstName) { alertDialog('What should we call you?', 'Please enter your first name.'); setLoading(false); return; }
      if (!acceptedTerms) {
        alertDialog('Terms required', 'Please accept the Terms of Service and Privacy Policy to create an account.');
        setLoading(false);
        return;
      }
      // Pass the name via user metadata. A DB trigger on auth.users creates the
      // public.users profile row from this — the old client-side insert ran as the
      // anonymous role (no session yet, since email confirmation is on) and RLS
      // rejected it, leaving new users without a profile.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName || null,
            terms_accepted_at: new Date().toISOString(),
          },
        },
      });
      if (error) { setLoading(false); alertDialog("Couldn't create your account", friendlyError(error, "We couldn't create your account. Please try again.")); return; }
      setLoading(false);
      // Email already registered. With "Confirm email" on, Supabase hides this
      // (no error, no email sent) and returns a placeholder user whose
      // identities list is empty. Without this check the shopper would wait on
      // the code screen for a code that never comes.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        alertDialog(
          'Email already registered',
          'An account with this email already exists. Sign in instead, or reset your password if you have forgotten it.',
          [
            { text: 'Reset password', onPress: () => router.push('/(auth)/reset-password') },
            { text: 'Sign in', onPress: () => setMode('login') },
          ],
        );
        return;
      }
      // Setting-agnostic: with email confirmation OFF, signUp returns a live
      // session — the user is signed in right now, so welcome them and move on.
      // With confirmation ON there's no session yet, so route them to their inbox.
      if (data.session) {
        alertDialog('Welcome to Litway Picks!', 'Your account is ready.');
        navigateAfterAuth();
        return;
      }
      // Email confirmation is on: Supabase emailed a 6-digit code. Collect it
      // on the verify screen, which signs them in once the code checks out.
      goToVerify(email.trim());
    }
  }

  function goToVerify(address: string) {
    // Android: never swap screens while a field on this one still holds focus
    // with the keyboard up. The outgoing ScrollView/KeyboardAvoidingView resizes
    // mid-transition with a focused child that is being detached, which can
    // crash natively ("Litway Picks has stopped").
    TextInput.State.currentlyFocusedInput()?.blur();
    Keyboard.dismiss();
    router.replace({
      pathname: '/(auth)/verify-email',
      params: { email: address, ...(isAllowedNext(next) ? { next } : {}) },
    } as any);
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
          {/* ─── Photo hero — melts into the canvas; all text lives below ─── */}
          <View style={{ height: HERO_H }}>
            <Image
              source={require('@/assets/images/auth-hero.jpg')}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              /* Anchor the crop to the top of the frame — the subject's face is
                 the picture; cover's default center-crop cuts it off. */
              contentPosition="top center"
              transition={300}
            />
            <LinearGradient
              colors={['rgba(236,236,236,0)', color.bg]}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 }}
            />
            <View style={{ position: 'absolute', top: insets.top + 8, left: 16 }}>
              <IconButton icon="close" variant="dark" onPress={() => router.back()} accessibilityLabel="Close" />
            </View>
          </View>

          {/* ─── Form — the brand mark leads the content ─── */}
          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom + 24, 40),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <LogoMark size={44} variant="onLight" />
              <Text variant="display">
                {mode === 'login' ? 'Welcome back.' : 'Create account.'}
              </Text>
            </View>
            <Text variant="body" tone="muted" style={{ marginBottom: 20 }}>
              {mode === 'login'
                ? 'Sign in to continue shopping'
                : 'Join thousands of happy shoppers'}
            </Text>
            {/* Pill segmented toggle */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: color.surfaceSunken,
                borderRadius: radius.full,
                padding: 4,
                marginBottom: 24,
              }}
            >
              {(['login', 'signup'] as Mode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: mode === m ? color.surface : 'transparent',
                    ...(mode === m ? shadow.header : {}),
                  }}
                >
                  <Text variant="bodyStrong" tone={mode === m ? 'default' : 'muted'}>
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Signup name fields */}
            {mode === 'signup' && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="First Name *"
                    leftIcon="person-outline"
                    value={firstName}
                    onChangeText={setFirstName}
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    ref={lastNameRef}
                    label="Last Name"
                    leftIcon="person-outline"
                    value={lastName}
                    onChangeText={setLastName}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <Input
              ref={emailRef}
              label="Email Address"
              leftIcon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <Input
              ref={passwordRef}
              label="Password"
              leftIcon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              isPassword
              returnKeyType="done"
              onSubmitEditing={handleAuth}
            />

            {mode === 'login' && (
              <TouchableOpacity
                onPress={() => router.push('/(auth)/reset-password')}
                style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 20 }}
              >
                <Text variant="small" tone="accent">
                  Forgot password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Terms must be actively accepted before an account is created */}
            {mode === 'signup' && (
              <TouchableOpacity
                onPress={() => setAcceptedTerms((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}
              >
                <Ionicons
                  name={acceptedTerms ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={acceptedTerms ? color.accent : color.textMuted}
                />
                <Text variant="small" tone="muted" style={{ flex: 1 }}>
                  I have read and agree to the{' '}
                  <Text variant="small" weight="semibold" tone="accent" onPress={() => router.push('/terms')}>
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text variant="small" weight="semibold" tone="accent" onPress={() => router.push('/privacy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>
            )}

            <Button
              title={mode === 'login' ? 'Sign In' : 'Create Account'}
              onPress={handleAuth}
              loading={loading}
              fullWidth
              size="lg"
              icon={<Ionicons name="arrow-forward" size={18} color={color.onAccent} />}
              style={{ marginTop: mode === 'signup' ? 8 : 0 }}
            />

            {/* Legal note — belongs to the button ("by continuing"), not the screen edge */}
            {mode === 'login' && (
            <Text variant="label" tone="muted" style={{ textAlign: 'center', marginTop: 12 }}>
              By continuing, you agree to our{' '}
              <Text weight="semibold" tone="muted" onPress={() => router.push('/terms')}>
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text weight="semibold" tone="muted" onPress={() => router.push('/privacy')}>
                Privacy Policy
              </Text>
            </Text>
            )}

            {mode === 'login' && biometricAvailable && (
              <Button
                title="Sign in with Biometrics"
                variant="outline"
                onPress={handleBiometricAuth}
                fullWidth
                icon={<Ionicons name="finger-print-outline" size={20} color={color.accent} />}
                style={{ marginTop: 12 }}
              />
            )}

            {/* Switch mode */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
              <Text variant="body" tone="muted">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                <Text variant="bodyStrong" tone="accent">
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
