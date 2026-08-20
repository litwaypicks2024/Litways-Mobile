import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@/components/ui/List';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useWishlistStore } from '@/store/wishlist';
import { useReviewedStore } from '@/store/reviewed';
import { color, font } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { HeartIllustration, ReceiptIllustration } from '@/components/illustrations';
import { ProductCard } from '@/components/shop/ProductCard';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import { formatCurrency } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Order } from '@/types';

type Tab = 'profile' | 'orders' | 'wishlist' | 'settings';

const VALID_TABS: Tab[] = ['profile', 'orders', 'wishlist', 'settings'];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  // Lets callers (e.g. confirmation.tsx's "Track Your Order") land directly
  // on a specific tab. Tab screens commonly stay mounted for the session, so
  // a plain useState initializer would miss a param that arrives on an
  // already-mounted instance — react to param changes explicitly instead.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>(
    VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'profile'
  );

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as Tab)) {
      setActiveTab(tabParam as Tab);
      // Consume the param immediately so it doesn't yank the user back to
      // this tab after they've since switched away manually.
      router.setParams({ tab: undefined });
    }
  }, [tabParam]);

  if (!user) {
    return (
      <View className="flex-1" style={{ backgroundColor: color.bg }}>
        <View className="bg-white border-b border-gray-100 px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
          <Text className="text-xl" style={{ color: color.ink, fontFamily: font.display }}>Account</Text>
        </View>
        <EmptyState
          icon="person-circle-outline"
          title="Sign in to your account"
          description="Access your orders, wishlist, and profile settings."
          actionLabel="Sign In"
          onAction={() => router.push('/(auth)/login')}
        />
      </View>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
    { key: 'orders', label: 'Orders', icon: 'receipt-outline' },
    { key: 'wishlist', label: 'Wishlist', icon: 'heart-outline' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: color.bg }}>
      <View className="bg-white border-b border-gray-100" style={{ paddingTop: insets.top + 12 }}>
        {/* Profile header */}
        <View className="flex-row items-center px-5 pb-4 gap-4">
          <View className="w-14 h-14 rounded-full bg-primary-100 items-center justify-center">
            <Text className="text-xl font-bold text-primary-600">
              {(profile?.first_name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base" style={{ color: color.ink, fontFamily: font.display }}>
              {profile ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : 'Welcome back'}
            </Text>
            <Text className="text-sm" style={{ color: color.inkMuted }}>{user.email}</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 4 }}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              className={`flex-row items-center px-4 py-2 rounded-full mr-2 ${activeTab === t.key ? 'bg-primary-600' : 'bg-gray-100'}`}
              style={{ gap: 6 }}
            >
              <Ionicons name={t.icon as any} size={14} color={activeTab === t.key ? '#fff' : color.inkMuted} />
              <Text className="text-sm font-medium" style={{ color: activeTab === t.key ? color.onAccent : color.inkMuted }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View className="h-3" />
      </View>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'orders' && <OrdersTab userId={user.id} />}
      {activeTab === 'wishlist' && <WishlistTab />}
      {activeTab === 'settings' && <SettingsTab onSignOut={signOut} />}
    </View>
  );
}

function ProfileTab() {
  const tabBarClearance = useTabBarClearance();
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
    city: profile?.city ?? '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
      });
    }
  }, [profile]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('users').update(form).eq('id', user.id);
      if (error) {
        Alert.alert("Couldn't save changes", error.message);
        return;
      }
      await fetchProfile(user.id);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { key: 'first_name', label: 'First Name', icon: 'person-outline' as const },
    { key: 'last_name', label: 'Last Name', icon: 'person-outline' as const },
    { key: 'phone', label: 'Phone', icon: 'call-outline' as const },
    { key: 'address', label: 'Address', icon: 'location-outline' as const },
    { key: 'city', label: 'City', icon: 'business-outline' as const },
  ] as const;

  return (
    <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarClearance }}>
      <Card>
        {fields.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            leftIcon={f.icon}
            value={form[f.key]}
            onChangeText={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
            editable={editing}
            containerStyle={!editing ? { backgroundColor: color.surfaceSunken } : undefined}
          />
        ))}

        <View className="flex-row gap-3 mt-2">
          {editing ? (
            <>
              <Button title="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              <Button title="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
            </>
          ) : (
            <Button title="Edit Profile" variant="outline" onPress={() => setEditing(true)} fullWidth icon={<Ionicons name="pencil-outline" size={16} color={color.accent} />} />
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

interface ReviewState {
  order: Order;
  item: { id: string; name: string; imageUrl?: string };
}

function ReviewModal({ state, onClose }: { state: ReviewState | null; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const markReviewed = useReviewedStore((s) => s.markReviewed);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!state) return null;

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      product_id: state!.item.id,
      order_id: state!.order.id,
      user_id: user!.id,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Error', 'Could not submit review. You may have already reviewed this product.');
    } else {
      markReviewed(state!.order.id, state!.item.id);
      queryClient.invalidateQueries({ queryKey: ['reviews', state!.item.id] });
      Alert.alert('Review submitted', 'Thank you for your feedback!');
      setRating(5);
      setComment('');
      onClose();
    }
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View
            className="bg-white rounded-t-3xl px-6 pt-5 pb-10"
            style={{ paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}
          >
            {/* Handle */}
            <View className="items-center mb-4">
              <View className="w-10 h-1 bg-gray-200 rounded-full" />
            </View>

            <Text className="text-base font-bold mb-1" style={{ color: color.ink }}>Write a Review</Text>
            <Text className="text-sm mb-5" numberOfLines={1} style={{ color: color.inkMuted }}>{state.item.name}</Text>

            {/* Star rating */}
            <Text className="text-sm font-semibold mb-2" style={{ color: color.ink }}>Your Rating</Text>
            <View className="flex-row gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} hitSlop={8}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? color.star : color.surfaceSunken}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment */}
            <Text className="text-sm font-semibold mb-2" style={{ color: color.ink }}>Comment (optional)</Text>
            <Input
              value={comment}
              onChangeText={setComment}
              placeholder="Share your experience with this product..."
              multiline
              numberOfLines={4}
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />

            <View className="flex-row gap-3">
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Submit Review" onPress={handleSubmit} loading={submitting} style={{ flex: 1 }} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OrdersTab({ userId }: { userId: string }) {
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const isReviewed = useReviewedStore((s) => s.isReviewed);

  const { data: orders, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['my-orders', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Couldn't load your orders. Check your connection and try again."
        onRetry={() => refetch()}
        loading={isFetching}
      />
    );
  }

  if (!orders?.length) {
    return (
      <EmptyState
        illustration={<ReceiptIllustration />}
        title="No orders yet"
        description="Your order history will appear here."
        actionLabel="Start Shopping"
        onAction={() => router.push('/(tabs)/shop')}
      />
    );
  }

  const COMPLETED_STATUSES = ['SUCCESSFUL', 'COMPLETED'];

  return (
    <>
      <FlashList
        data={orders}
        estimatedItemSize={140}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarClearance }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={color.accent} />
        }
        renderItem={({ item: order }) => {
          const items = (order.items as any[]) ?? [];
          const firstImg = items[0]?.imageUrl;
          const isCompleted = COMPLETED_STATUSES.includes(order.payment_status ?? '');

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/order/${order.id}` as any)}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
            >
              <View className="flex-row items-center justify-between mb-3">
                <View>
                  <Text className="text-xs font-medium" style={{ color: color.inkFaint }}>{order.external_id}</Text>
                  <Text className="text-xs mt-0.5" style={{ color: color.inkFaint }}>
                    {new Date(order.created_at!).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Badge label={order.payment_status} status={order.payment_status} />
              </View>

              <View className="flex-row items-center gap-3">
                {firstImg && (
                  <View className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100">
                    <Image source={{ uri: firstImg }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-sm" numberOfLines={1} style={{ color: color.inkMuted }}>
                    {items.length} {items.length === 1 ? 'item' : 'items'} · {order.delivery_state}
                  </Text>
                  <Text className="text-base text-primary-600 mt-1" style={{ fontFamily: font.displayHeavy }}>
                    {formatCurrency(order.final_total)}
                  </Text>
                </View>
              </View>

              {/* Write review for completed orders */}
              {isCompleted && items.length > 0 && (
                <View className="mt-3 pt-3 border-t border-gray-50">
                  <Text className="text-xs mb-2 font-medium" style={{ color: color.inkFaint }}>Leave a review:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {items.map((item: any) => {
                      const reviewed = isReviewed(order.id, item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          disabled={reviewed}
                          onPress={() => setReviewState({ order, item: { id: item.id, name: item.name, imageUrl: item.imageUrl } })}
                          className={`flex-row items-center gap-2 rounded-full px-3 py-2 border ${reviewed ? 'bg-gray-50 border-gray-100' : 'bg-primary-50 border-primary-100'}`}
                        >
                          {!reviewed && <Ionicons name="star-outline" size={13} color={color.accent} />}
                          <Text
                            className={`text-xs font-semibold ${reviewed ? '' : 'text-primary-700'}`}
                            numberOfLines={1}
                            style={{ maxWidth: 120, color: reviewed ? color.inkFaint : undefined }}
                          >
                            {reviewed ? 'Reviewed ✓' : item.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
      <ReviewModal state={reviewState} onClose={() => setReviewState(null)} />
    </>
  );
}

function WishlistTab() {
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const items = useWishlistStore((s) => s.items);

  const products = useMemo(
    () =>
      items.map((item) => ({
        id: item.productId,
        slug: item.slug,
        name: item.name,
        brand: item.brand,
        price: item.price,
        sale_price: item.salePrice ?? null,
        stock: item.stock,
        image_urls: [item.imageUrl],
        rating: null,
        review_count: null,
      } as any)),
    [items]
  );

  if (!items.length) {
    return (
      <EmptyState
        illustration={<HeartIllustration />}
        title="Your wishlist is empty"
        description="Save items you love and come back later."
        actionLabel="Browse Shop"
        onAction={() => router.push('/(tabs)/shop')}
      />
    );
  }

  return (
    <FlashList
      data={products}
      numColumns={2}
      estimatedItemSize={230}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 12, paddingBottom: tabBarClearance }}
      renderItem={({ item }) => (
        <View style={{ flex: 1, margin: 6 }}>
          <ProductCard product={item} />
        </View>
      )}
    />
  );
}

function SettingsTab({ onSignOut }: { onSignOut: () => void }) {
  const tabBarClearance = useTabBarClearance();
  const user = useAuthStore((s) => s.user);
  const [changingPw, setChangingPw] = useState(false);
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleChangePassword() {
    if (pw.length < 8) { Alert.alert('Weak password', 'Password must be at least 8 characters.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Success', 'Password updated successfully');
    setChangingPw(false);
    setPw('');
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onSignOut },
    ]);
  }

  return (
    <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarClearance }}>
      <Card padded={false} style={{ overflow: 'hidden', marginBottom: 16 }}>
        <View className="px-4 py-3 border-b border-gray-50">
          <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: color.inkFaint }}>Account</Text>
        </View>
        <View className="px-4 py-3 border-b border-gray-50">
          <Text className="text-xs" style={{ color: color.inkMuted }}>Email</Text>
          <Text className="text-sm font-medium mt-0.5" style={{ color: color.ink }}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={() => setChangingPw(!changingPw)} className="px-4 py-3 flex-row items-center justify-between">
          <Text className="text-sm font-medium" style={{ color: color.ink }}>Change Password</Text>
          <Ionicons name={changingPw ? 'chevron-up' : 'chevron-down'} size={16} color={color.inkFaint} />
        </TouchableOpacity>
        {changingPw && (
          <View className="px-4 pb-4">
            <Input
              label="New Password"
              isPassword
              value={pw}
              onChangeText={setPw}
              placeholder="Minimum 8 characters"
            />
            <Button title="Update Password" onPress={handleChangePassword} loading={saving} size="sm" />
          </View>
        )}
      </Card>

      <Button
        title="Sign Out"
        variant="outline"
        onPress={handleSignOut}
        fullWidth
        icon={<Ionicons name="log-out-outline" size={18} color={color.accent} />}
        style={{ borderColor: color.danger, marginBottom: 12 }}
      />
    </ScrollView>
  );
}
