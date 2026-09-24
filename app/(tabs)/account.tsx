import React, { useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { color, gutter, radius, shadow, spacing } from '@/theme/tokens';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { alertDialog } from '@/components/ui/Dialog';
import { ListGroup, ListRow } from '@/components/account/ListRow';
import { ActiveOrderCard } from '@/components/home/ActiveOrderCard';

/**
 * Account hub. Nothing is edited here: every task is a row or tile that opens
 * its own screen (personal details, orders, password, support, legal), the way
 * the account tabs in Uber Eats / Gojek / Crate & Barrel work. Signed-out
 * shoppers get the same support and legal rows under a sign-in prompt.
 */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const clearance = useTabBarClearance();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const syncFailed = useCartStore((s) => s.syncFailed);
  const favoriteCount = useWishlistStore((s) => s.items.length);

  // Older deep links (confirmation → "Track your order", Home shortcut) land here with ?tab=orders.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    if (!tab) return;
    router.setParams({ tab: undefined });
    if (tab === 'orders') router.push('/orders');
  }, [tab]);

  function handleSignOut() {
    // signOut() flushes the cart best-effort first, but that can fail — say so.
    const message = syncFailed
      ? "Some cart changes haven't synced yet and may be lost. Are you sure you want to sign out?"
      : 'Are you sure you want to sign out?';
    alertDialog('Sign out', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  const fullName = profile ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : '';
  const initial = (profile?.first_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const profileIncomplete = !!user && (!profile?.phone || !profile?.address);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ backgroundColor: color.surface, paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg, paddingHorizontal: gutter, ...shadow.header }}>
        {user ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="title" tone="accent">{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="title" numberOfLines={1}>{fullName || 'Welcome back'}</Text>
              <Text variant="body" tone="muted" numberOfLines={1}>{user.email}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/edit-profile')}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0,
                paddingHorizontal: 14, height: 38, borderRadius: radius.full,
                borderWidth: 1.5, borderColor: color.fieldBorder, backgroundColor: color.surface,
              }}
            >
              <Ionicons name="pencil" size={14} color={color.ink} />
              <Text variant="small">Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text variant="display">Your account</Text>
            <Text variant="bodyLg" tone="body" style={{ marginTop: 4 }}>
              Sign in to track orders, save favorites and check out faster.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button title="Sign in" onPress={() => router.push('/(auth)/login')} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Create account" variant="outline" onPress={() => router.push({ pathname: '/(auth)/login', params: { mode: 'signup' } })} fullWidth />
              </View>
            </View>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: clearance + spacing.lg }}>
        {user && <ActiveOrderCard />}

        {/* Quick tiles */}
        {user && (
          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: gutter, marginTop: spacing.lg }}>
            <Tile icon="receipt-outline" label="Orders" onPress={() => router.push('/orders')} />
            <Tile icon="heart-outline" label="Favorites" count={favoriteCount} onPress={() => router.push('/(tabs)/favorites')} />
            <Tile icon="headset-outline" label="Help" onPress={() => router.push('/contact')} />
          </View>
        )}

        {/* Nudge until phone and address are filled in */}
        {profileIncomplete && (
          <PressableScale
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            style={{ marginHorizontal: gutter, marginTop: spacing.lg }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: color.accentSoft, borderRadius: radius.lg, padding: spacing.lg }}>
              <Ionicons name="flash-outline" size={22} color={color.accent} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Finish your profile</Text>
                <Text variant="meta" tone="body">Add your phone and delivery address to check out faster.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={color.accentText} />
            </View>
          </PressableScale>
        )}

        {user && (
          <ListGroup title="Account">
            <ListRow
              icon="person-outline"
              label="Personal details"
              subtitle={profile?.phone ? profile.phone : 'Name, phone and delivery address'}
              onPress={() => router.push('/edit-profile')}
            />
            <ListRow icon="receipt-outline" label="My orders" subtitle="Track, review and reorder" onPress={() => router.push('/orders')} />
            <ListRow icon="lock-closed-outline" label="Change password" onPress={() => router.push('/change-password')} />
          </ListGroup>
        )}

        <ListGroup title="Support">
          <ListRow icon="headset-outline" label="Contact us" subtitle="We reply within 24 hours" onPress={() => router.push('/contact')} />
          <ListRow icon="bicycle-outline" label="Shipping & delivery" onPress={() => router.push('/shipping')} />
          <ListRow icon="return-down-back-outline" label="Returns & refunds" onPress={() => router.push('/returns')} />
        </ListGroup>

        <ListGroup title="About">
          <ListRow icon="information-circle-outline" label="About Litway Picks" onPress={() => router.push('/about')} />
          <ListRow icon="shield-checkmark-outline" label="Privacy policy" onPress={() => router.push('/privacy')} />
          <ListRow icon="document-text-outline" label="Terms & conditions" onPress={() => router.push('/terms')} />
        </ListGroup>

        {user && (
          <ListGroup>
            <ListRow icon="log-out-outline" label="Sign out" danger noChevron onPress={handleSignOut} />
          </ListGroup>
        )}

        <Text variant="meta" tone="muted" style={{ textAlign: 'center', marginTop: spacing.xl }}>
          Litway Picks · v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </View>
  );
}

function Tile({ icon, label, count, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; count?: number; onPress: () => void }) {
  return (
    <PressableScale haptic onPress={onPress} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label} style={{ flex: 1 }}>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm, ...shadow.card }}>
        <View>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={22} color={color.accent} />
          </View>
          {!!count && (
            <View style={{ position: 'absolute', top: -4, right: -8, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: color.accentFill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: color.surface }}>
              <Text variant="overline" style={{ color: '#fff', textTransform: 'none', letterSpacing: 0 }}>{count > 99 ? '99+' : count}</Text>
            </View>
          )}
        </View>
        <Text variant="small">{label}</Text>
      </View>
    </PressableScale>
  );
}
