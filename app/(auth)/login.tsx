import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { color, radius, shadow, type as t } from '@/theme/tokens';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LogoMark } from '@/components/brand/LogoMark';

type Mode = 'login' | 'signup';

const HERO_H = Math.round(Dimensions.get('window').height * 0.34);

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

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
      if (session) router.back();
      else Alert.alert('Session expired', 'Please sign in with your email and password.');
    }
  }

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (error) { Alert.alert('Sign In Failed', error.message); return; }
      router.back();
    } else {
      if (!firstName) { Alert.alert('Missing fields', 'Please enter your first name.'); setLoading(false); return; }
      // Pass the name via user metadata. A DB trigger on auth.users creates the
      // public.users profile row from this — the old client-side insert ran as the
      // anonymous role (no session yet, since email confirmation is on) and RLS
      // rejected it, leaving new users without a profile.
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName || null,
          },
        },
      });
      if (error) { setLoading(false); Alert.alert('Sign Up Failed', error.message); return; }
      setLoading(false);
      Alert.alert('Account Created', 'Welcome to Litway Picks! Check your email to verify your account.');
      router.back();
    }
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
              transition={300}
            />
            <LinearGradient
              colors={['rgba(236,236,236,0)', color.bg]}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 }}
            />
            <View style={{ position: 'absolute', top: insets.top + 8, left: 16 }}>
              <IconButton icon="close" variant="dark" onPress={() => router.back()} />
            </View>
          </View>

          {/* ─── Form — the brand mark leads the content ─── */}
          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              paddingTop: 4,
              paddingBottom: Math.max(insets.bottom + 24, 40),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <LogoMark size={44} variant="onLight" />
              <Text style={{ ...t.display, fontSize: 28, lineHeight: 34 }}>
                {mode === 'login' ? 'Welcome back.' : 'Create account.'}
              </Text>
            </View>
            <Text style={{ ...t.body, color: color.inkMuted, marginBottom: 20 }}>
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
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: mode === m ? '800' : '600',
                      color: mode === m ? color.ink : color.inkMuted,
                    }}
                  >
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
                <Text style={{ fontSize: 13, color: color.accent, fontWeight: '600' }}>
                  Forgot password?
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
              <Text style={{ fontSize: 14, color: color.inkMuted }}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                <Text style={{ fontSize: 14, color: color.accent, fontWeight: '700' }}>
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Legal note */}
            <Text style={{ fontSize: 11, color: color.inkFaint, textAlign: 'center', marginTop: 16, lineHeight: 16 }}>
              By continuing, you agree to our{' '}
              <Text style={{ color: color.inkMuted }}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={{ color: color.inkMuted }}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
