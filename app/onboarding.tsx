import React, { useEffect, useState } from 'react';
import { BackHandler, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, ReduceMotion, SlideInRight } from 'react-native-reanimated';
import { color } from '@/theme/tokens';
import { IntroPager } from '@/components/onboarding/IntroPager';
import { InterestPicker } from '@/components/onboarding/InterestPicker';
import { NotificationPrimer } from '@/components/onboarding/NotificationPrimer';
import { showToast } from '@/components/ui/Toast';
import { onboarding } from '@/lib/storage';
import { registerForPushNotifications } from '@/lib/notifications';
import { useTasteStore } from '@/store/taste';
import type { Category } from '@/types';

type Step = 'intro' | 'interests' | 'notify';

/**
 * First-launch flow: a three-slide animated intro, then "what are you into?"
 * (seeds personalization), then a notification pre-prompt (asks in our own
 * words before the system does), then Home. Every step after the intro can be
 * skipped, and the sign-in link on the last slide leaves at once.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [picked, setPicked] = useState<Category[]>([]);
  // Back from a later step returns to the last slide, not the first.
  const [introIndex, setIntroIndex] = useState(0);

  // Android back walks the steps backwards; on the intro it leaves the app as usual.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'notify') { setStep('interests'); return true; }
      if (step === 'interests') { setIntroIndex(2); setStep('intro'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  async function finish(destination: 'home' | 'signin' = 'home') {
    await onboarding.markSeen();
    router.replace('/(tabs)');
    if (destination === 'signin') {
      router.push('/(auth)/login');
      return;
    }
    if (picked.length > 0) {
      const names = picked.slice(0, 2).map((c) => c.name).join(' and ');
      showToast({ title: "You're all set", detail: `Showing you ${names}${picked.length > 2 ? ' and more' : ''} first`, tone: 'success' });
    }
  }

  function seedAndContinue(chosen: Category[]) {
    setPicked(chosen);
    if (chosen.length) useTasteStore.getState().seedInterests(chosen.map((c) => ({ slug: c.slug, name: c.name })));
    setStep('notify');
  }

  async function allowNotifications() {
    // Shows the system prompt (a no-op in Expo Go). The token is cached and attached to the account at sign-in.
    await registerForPushNotifications();
    await finish();
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={color.surface} />
      {step === 'intro' && (
        <Animated.View key="intro" style={{ flex: 1 }} exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}>
          <IntroPager initialIndex={introIndex} onDone={() => setStep('interests')} onSignIn={() => finish('signin')} />
        </Animated.View>
      )}
      {step === 'interests' && (
        <Animated.View key="interests" style={{ flex: 1 }} entering={SlideInRight.duration(280).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}>
          <InterestPicker
            onBack={() => { setIntroIndex(2); setStep('intro'); }}
            onSkip={() => setStep('notify')}
            onContinue={seedAndContinue}
          />
        </Animated.View>
      )}
      {step === 'notify' && (
        <Animated.View key="notify" style={{ flex: 1 }} entering={SlideInRight.duration(280).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}>
          <NotificationPrimer onBack={() => setStep('interests')} onAllow={allowNotifications} onLater={() => finish()} />
        </Animated.View>
      )}
    </>
  );
}
