import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { timeAgo, type InboxEntry } from '@/lib/inbox';
import type { InboxKind } from '@/store/inbox';
import { color, radius, spacing } from '@/theme/tokens';

const KIND: Record<InboxKind, { icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string; label: string }> = {
  order: { icon: 'receipt-outline', fg: '#1e40af', bg: '#dbeafe', label: 'Order update' },
  stock: { icon: 'checkmark-circle', fg: '#166534', bg: '#dcfce7', label: 'Back in stock' },
  price: { icon: 'pricetag', fg: color.accentText, bg: color.peachTint, label: 'Price drop' },
  promo: { icon: 'megaphone-outline', fg: '#92400e', bg: '#fef3c7', label: 'Offer' },
  system: { icon: 'notifications-outline', fg: color.inkBody, bg: color.surfaceMuted, label: 'Notice' },
};

interface Props {
  entry: InboxEntry;
  first: boolean;
  last: boolean;
  onPress: () => void;
  onMenu: () => void;
}

/** One notification: type icon (or product photo), title, two lines of body, time, unread dot and a menu. */
export const InboxRow = React.memo(function InboxRow({ entry, first, last, onPress, onMenu }: Props) {
  const k = KIND[entry.kind];
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onMenu}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={`${entry.unread ? 'Unread. ' : ''}${k.label}. ${entry.title}. ${entry.body}. ${timeAgo(entry.at)}`}
      accessibilityHint="Opens it. Long press for more options."
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingVertical: 14, paddingHorizontal: spacing.lg,
        backgroundColor: entry.unread ? color.accentSoft : color.surface,
        borderTopLeftRadius: first ? radius.xl : 0, borderTopRightRadius: first ? radius.xl : 0,
        borderBottomLeftRadius: last ? radius.xl : 0, borderBottomRightRadius: last ? radius.xl : 0,
        borderTopWidth: first ? 0 : 1, borderTopColor: color.border,
      }}
    >
      <View>
        {entry.imageUrl ? (
          <Image source={{ uri: entry.imageUrl }} style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: color.surfaceSunken }} contentFit="cover" />
        ) : (
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: k.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={k.icon} size={22} color={k.fg} />
          </View>
        )}
        {entry.unread && (
          <View style={{ position: 'absolute', top: -3, left: -3, width: 13, height: 13, borderRadius: 7, backgroundColor: color.accentFill, borderWidth: 2, borderColor: color.surface }} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant={entry.unread ? 'bodyStrong' : 'body'} numberOfLines={1}>{entry.title}</Text>
        {!!entry.body && <Text variant="caption" tone="body" numberOfLines={2} style={{ marginTop: 2 }}>{entry.body}</Text>}
        <Text variant="meta" tone="muted" style={{ marginTop: 4 }}>{timeAgo(entry.at)}</Text>
      </View>

      <TouchableOpacity onPress={onMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="More options" style={{ paddingTop: 2 }}>
        <Ionicons name="ellipsis-horizontal" size={18} color={color.inkFaint} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});
