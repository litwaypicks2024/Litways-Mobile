import '../global.css';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Alert } from 'react-native';
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
import { useWishlistStore } from '@/store/wishlist';
import { onboarding, pendingPayment } from '@/lib/storage';
import { registerForPushNotifications, savePushToken, syncPushTokenForUser, useNotificationListener, getLastNotificationResponse } from '@/lib/notifications';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { BrandSplash } from '@/components/BrandSplash';
import { FlyToCartOverlay } from '@/components/motion/FlyToCart';
import { LoadingOverlay } from '@/components/motion/LoadingOverlay';

// Hard cap on the post-sign-in hydration overlay (Moment 1 below) — clears
// even if fetchProfile/loadFromDb/loadWishlistFromDb/syncPushTokenForUser
// hang, so a slow network never traps the shopper behind the overlay.
const POST_AUTH_HYDRATION_MAX_MS = 2500;

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

// Defense in depth: only forward well-formed reference ids to the
// confirmation screen. This does not fix the underlying unauthenticated
// order-lookup endpoint (see wave1-security.md) but rejects obviously
// crafted/malformed values before they trigger a fetch.
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

/** Shared by cold-start and while-running deep link handling below. */
function parseDeepLink(url: string): { pathname: string; params?: Record<string, string> } | null {
  const { path, queryParams } = Linking.parse(url);
  if (!path) return null;
  if (path.startsWith('product/')) return { pathname: `/${path}` };
  if (
    path === 'confirmation' &&
    typeof queryParams?.referenceId === 'string' &&
    REFERENCE_ID_PATTERN.test(queryParams.referenceId)
  ) {
    return { pathname: '/confirmation', params: { referenceId: queryParams.referenceId } };
  }
  if (path.startsWith('category/')) return { pathname: `/${path}` };
  return null;
}

// Prefixes a notification's `data.screen` must match before we'll navigate —
// a push payload is server/attacker-influenced, so route it like any other
// untrusted deep link rather than pushing it blindly.
const NOTIFICATION_SCREEN_ALLOWLIST = ['/product/', '/category/', '/confirmation', '/(tabs)'];

function isAllowedNotificationScreen(screen: string): boolean {
  return NOTIFICATION_SCREEN_ALLOWLIST.some((prefix) => screen.startsWith(prefix));
}

const PENDING_PAYMENT_MAX_AGE_MS = 30 * 60 * 1000;

// Cold start recovery for a payment that was initiated but never reached a
// terminal state locally (e.g. the app was killed mid-poll — see
// lib/storage.ts pendingPayment and checkout.tsx's beforeRemove guard). Skip
// entirely if we're already navigating to confirmation for this launch, or
// if the record is stale enough that checking is unlikely to be useful.
async function checkPendingPaymentOnStartup(
  router: ReturnType<typeof useRouter>,
  alreadyGoingToConfirmation: boolean
) {
  if (alreadyGoingToConfirmation) return;
  const record = await pendingPayment.get();
  if (!record) return;
  if (Date.now() - record.createdAt > PENDING_PAYMENT_MAX_AGE_MS) {
    await pendingPayment.clear();
    return;
  }
  Alert.alert(
    'Payment in progress',
    "You have a payment in progress — check its status?",
    [
      // Not a decline — the record stays. TTL (PENDING_PAYMENT_MAX_AGE_MS,
      // checked above) is what eventually stops re-prompting, not this tap;
      // clearing it here would drop the one payment still worth recovering.
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Check status',
        onPress: () => {
          router.push({ pathname: '/confirmation', params: { referenceId: record.referenceId } } as any);
        },
      },
    ]
  );
}

function AppContent() {
  const setSession = useAuthStore((s) => s.setSession);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const loadFromDb = useCartStore((s) => s.loadFromDb);
  const loadWishlistFromDb = useWishlistStore((s) => s.loadFromDb);
  const router = useRouter();

  // Branded splash stays up until the session + onboarding state resolve AND the
  // display font finishes loading, then fades.
  const [startupDone, setStartupDone] = useState(false);
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });
  // Hold the splash long enough for its assembly choreography (~1.4s) to
  // land, even when fonts/session resolve instantly (dev, warm caches).
  const [splashMinHoldDone, setSplashMinHoldDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSplashMinHoldDone(true), 1700);
    return () => clearTimeout(timer);
  }, []);
  const appReady = startupDone && fontsLoaded && splashMinHoldDone;
  const [showSplash, setShowSplash] = useState(true);
  // hydrate() below lives inside a mount-once ([]) effect, so it can't see
  // showSplash updates via closure — mirror the latest value into a ref it
  // can read instead.
  const showSplashRef = useRef(showSplash);
  useEffect(() => {
    showSplashRef.current = showSplash;
  }, [showSplash]);

  // Branded overlay for a genuine post-sign-in hydration (Moment 1) — not
  // shown for the cold-start session restore (BrandSplash covers that) or
  // for token refreshes of the same user. See previousUserIdRef below.
  const [postAuthHydrating, setPostAuthHydrating] = useState(false);
  const hydrationCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // A debounced cart write is only scheduled 800ms out — if the app is
  // backgrounded/closed before it fires, that edit would otherwise only ever
  // reach AsyncStorage, not the shared `carts` row. Flush any pending write
  // immediately when the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        const userId = useAuthStore.getState().user?.id;
        if (userId) void useCartStore.getState().flushSync(userId);
      }
    });
    return () => sub.remove();
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

  // Tracks whether we've observed a signed-in session, so we only purge local
  // cart/wishlist on a genuine sign-out transition — not on every guest launch
  // where session is null from the start.
  const hadSessionRef = useRef(false);

  // Tracks the last known signed-in user id (null when signed out or not yet
  // resolved) so hydrate() below can tell a genuine sign-in (id goes from
  // null/another id to a new id) apart from a token refresh for the same
  // user, which fires the same auth-change event but shouldn't retrigger
  // the hydration overlay.
  const previousUserIdRef = useRef<string | null>(null);

  // Whether this launch is already routing to /confirmation on its own —
  // resolved once startup settles (success or fail-open), then acted on only
  // once the splash is actually gone (see the appReady effect below), so the
  // native Alert never fires underneath/before it finishes fading.
  const pendingPaymentCheckRef = useRef<{ alreadyGoingToConfirmation: boolean } | null>(null);
  const pendingPaymentCheckedRef = useRef(false);
  useEffect(() => {
    if (!appReady) return;
    if (pendingPaymentCheckedRef.current) return;
    if (!pendingPaymentCheckRef.current) return;
    pendingPaymentCheckedRef.current = true;
    void checkPendingPaymentOnStartup(router, pendingPaymentCheckRef.current.alreadyGoingToConfirmation);
  }, [appReady]);

  // Auth + cart hydration
  useEffect(() => {
    function hydrate(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
      setSession(session);
      if (session?.user) {
        const userId = session.user.id;
        // A genuine sign-in: the known user id actually changed (not a
        // token refresh for the same user), and it's happening after the
        // splash has already resolved (the cold-start session restore is
        // covered by BrandSplash, not this overlay).
        const isGenuineSignIn = previousUserIdRef.current !== userId && !showSplashRef.current;
        previousUserIdRef.current = userId;

        hadSessionRef.current = true;
        const profilePromise = fetchProfile(userId);
        const cartPromise = loadFromDb(userId);
        // Non-blocking: wishlist load/merge should never hold up startup or
        // the auth-change handler, and loadFromDb itself never throws (it
        // logs and leaves local state untouched on a fetch error).
        const wishlistPromise = loadWishlistFromDb(userId);
        registerPushOnce(userId);
        // Cheap no-op unless registration already cached a token this
        // session (e.g. it ran before this session had a signed-in user) —
        // covers sign-in-after-registration so that token still ends up
        // owned by this user in push_tokens.
        const pushTokenPromise = syncPushTokenForUser(userId);

        if (isGenuineSignIn) {
          setPostAuthHydrating(true);
          if (hydrationCapTimerRef.current) clearTimeout(hydrationCapTimerRef.current);
          hydrationCapTimerRef.current = setTimeout(() => {
            hydrationCapTimerRef.current = null;
            setPostAuthHydrating(false);
          }, POST_AUTH_HYDRATION_MAX_MS);
          Promise.allSettled([profilePromise, cartPromise, wishlistPromise, pushTokenPromise]).then(() => {
            if (hydrationCapTimerRef.current) {
              clearTimeout(hydrationCapTimerRef.current);
              hydrationCapTimerRef.current = null;
            }
            setPostAuthHydrating(false);
          });
        }
      } else {
        previousUserIdRef.current = null;
        registeredUserRef.current = null;
        if (hadSessionRef.current) {
          // Session transitioned from signed-in to signed-out — covers
          // token-expiry/forced sign-outs that never call the store's
          // signOut() action. Purge local cart/wishlist so the next
          // sign-in on this device can't inherit stale items (see
          // wave2b-ux-flows.md — cross-account cart bleed).
          useCartStore.getState().cancelSync();
          useCartStore.getState().clearCart();
          useWishlistStore.getState().clear();
        }
        hadSessionRef.current = false;
      }
    }

    // Resolve startup state first (session, onboarding, and whether we were
    // cold-started via a deep link) before deciding where to navigate — a
    // deep link and the onboarding redirect both want to run router.replace
    // on first paint, and whichever wins by chance used to depend on which
    // promise resolved first (wave2 round1 finding: deep-link vs onboarding
    // race). RULING: deep-linked content wins over onboarding this launch.
    Promise.all([
      supabase.auth.getSession(),
      onboarding.hasSeen(),
      Linking.getInitialURL(),
      // Also resolved here (in addition to the dedicated cold-start-via-
      // notification effect below) purely to know whether THIS launch is
      // about to route to /confirmation on its own, so the pending-payment
      // prompt below doesn't fire redundantly on top of it. Expo caches this
      // response until cleared, so reading it twice is safe.
      getLastNotificationResponse(),
    ])
      .then(([{ data: { session } }, seenOnboarding, initialUrl, notifResponse]) => {
        hydrate(session);
        const initialDeepLink = initialUrl ? parseDeepLink(initialUrl) : null;
        if (initialDeepLink) {
          router.push(initialDeepLink as any);
        } else if (!seenOnboarding && !session) {
          // First-time, signed-out shoppers get the one-time intro. Returning
          // or signed-in users (or anyone arriving via a valid deep link) go
          // straight to the store. Cast: typed-routes union regenerates on
          // next dev-server run.
          router.replace('/onboarding' as any);
        }
        SplashScreen.hideAsync();
        const notifScreen = (notifResponse?.notification?.request?.content?.data as
          | Record<string, string>
          | undefined)?.screen;
        const goingToConfirmationViaNotification =
          typeof notifScreen === 'string' && notifScreen.startsWith('/confirmation');
        pendingPaymentCheckRef.current = {
          alreadyGoingToConfirmation:
            initialDeepLink?.pathname === '/confirmation' || goingToConfirmationViaNotification,
        };
        setStartupDone(true);
      })
      .catch((err) => {
        // A storage or network hiccup here used to leave BrandSplash up
        // forever (Promise.all had no catch). Fail open instead: treat the
        // shopper as signed-out with onboarding already seen so a transient
        // error never traps a returning user on the intro screen. The
        // pending-payment check still needs to run on this path too — it
        // didn't before, silently skipping recovery whenever startup failed.
        console.warn('Startup hydration failed, continuing as signed-out:', err);
        hydrate(null);
        SplashScreen.hideAsync();
        pendingPaymentCheckRef.current = { alreadyGoingToConfirmation: false };
        setStartupDone(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session);
    });

    return () => {
      listener.subscription.unsubscribe();
      if (hydrationCapTimerRef.current) clearTimeout(hydrationCapTimerRef.current);
    };
  }, []);

  // Deep links that arrive while the app is already running (cold-start links
  // are handled above, before the onboarding decision).
  useEffect(() => {
    const sub = Linking.addEventListener('url', (e) => {
      const dest = parseDeepLink(e.url);
      if (dest) router.push(dest as any);
    });
    return () => sub.remove();
  }, []);

  // Cold start via a tapped notification — addNotificationResponseReceivedListener
  // below only fires for taps while the app is foregrounded/backgrounded, not
  // for the notification that launched a killed app. Guard with a ref so the
  // cached response (Expo keeps returning it until cleared) is only acted on
  // once per app launch.
  const handledInitialNotificationRef = useRef(false);
  useEffect(() => {
    if (handledInitialNotificationRef.current) return;
    handledInitialNotificationRef.current = true;
    getLastNotificationResponse().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.screen && isAllowedNotificationScreen(data.screen)) {
        router.push(data.screen as any);
      }
    });
  }, []);

  // Navigate to the relevant screen when a notification is tapped while the
  // app is running. `data.screen` is server/push-payload controlled, so it's
  // validated against an allowlist before navigating rather than trusted.
  useNotificationListener((response) => {
    const data = response.notification.request.content.data as Record<string, string>;
    if (data?.screen && isAllowedNotificationScreen(data.screen)) {
      router.push(data.screen as any);
    }
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
    <LoadingOverlay
      visible={postAuthHydrating}
      title="Setting up your shop…"
      subtitle="Syncing your cart and saved items"
    />
    <FlyToCartOverlay />
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
