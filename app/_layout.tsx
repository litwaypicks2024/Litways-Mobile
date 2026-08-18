import '../global.css';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { onboarding } from '@/lib/storage';
import { registerForPushNotifications, savePushToken, useNotificationListener } from '@/lib/notifications';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { BrandSplash } from '@/components/BrandSplash';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});

function AppContent() {
  const setSession = useAuthStore((s) => s.setSession);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const loadFromDb = useCartStore((s) => s.loadFromDb);
  const router = useRouter();

  // Branded splash stays up until the session + onboarding state resolve AND the
  // display font finishes loading, then fades.
  const [startupDone, setStartupDone] = useState(false);
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });
  const appReady = startupDone && fontsLoaded;
  const [showSplash, setShowSplash] = useState(true);

  // Persist the cart back to the server (debounced) whenever it changes while
  // signed in. loadFromDb only *reads*; without this the DB copy goes stale.
  useEffect(() => {
    const unsubscribe = useCartStore.subscribe((state, prev) => {
      if (state.items === prev.items) return;
      const userId = useAuthStore.getState().user?.id;
      if (userId) state.syncToDb(userId);
    });
    return unsubscribe;
  }, []);

  // Register for push at most once per signed-in user. onAuthStateChange fires
  // on every token refresh/focus, so without this the permission prompt + token
  // fetch would repeat needlessly.
  const registeredUserRef = useRef<string | null>(null);
  function registerPushOnce(userId: string) {
    if (registeredUserRef.current === userId) return;
    registeredUserRef.current = userId;
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(userId, token);
    });
  }

  // Auth + cart hydration
  useEffect(() => {
    function hydrate(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        loadFromDb(session.user.id);
        registerPushOnce(session.user.id);
      } else {
        registeredUserRef.current = null;
      }
    }

    Promise.all([supabase.auth.getSession(), onboarding.hasSeen()]).then(
      ([{ data: { session } }, seenOnboarding]) => {
        hydrate(session);
        // First-time, signed-out shoppers get the one-time intro. Returning or
        // signed-in users go straight to the store.
        if (!seenOnboarding && !session) {
          // Cast: typed-routes union regenerates on next dev-server run.
          router.replace('/onboarding' as any);
        }
        SplashScreen.hideAsync();
        setStartupDone(true);
      }
    );

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Deep link handler
  useEffect(() => {
    function handleUrl(url: string) {
      const { path, queryParams } = Linking.parse(url);
      if (!path) return;
      if (path.startsWith('product/')) {
        router.push(`/${path}` as any);
      } else if (path === 'confirmation' && queryParams?.referenceId) {
        router.push({ pathname: '/confirmation', params: { referenceId: queryParams.referenceId as string } });
      } else if (path.startsWith('category/')) {
        router.push(`/${path}` as any);
      }
    }

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  // Navigate to the relevant screen when a notification is tapped
  useNotificationListener((response) => {
    const data = response.notification.request.content.data as Record<string, string>;
    if (data?.screen) router.push(data.screen as any);
  });

  return (
    <>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen
        name="product/[slug]"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="checkout"
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="confirmation"
        options={{ headerShown: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="category/[slug]"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
    </Stack>
    {showSplash && <BrandSplash visible={!appReady} onHidden={() => setShowSplash(false)} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
