import React from 'react';
import { FlatList, type FlatListProps } from 'react-native';
import Constants from 'expo-constants';

// FlashList requires the AutoLayoutView native component which isn't in Expo Go.
// This shim renders FlatList in Expo Go and the real FlashList in dev/prod builds.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// Accept every FlatList prop (so item/keyExtractor are typed via T) plus FlashList's
// estimatedItemSize. Both list implementations share these props.
type Props<T> = FlatListProps<T> & { estimatedItemSize?: number };

export function FlashList<T>({ estimatedItemSize, ...props }: Props<T>) {
  if (!IS_EXPO_GO) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FlashList: NativeFlashList } = require('@shopify/flash-list');
    return <NativeFlashList estimatedItemSize={estimatedItemSize} {...props} />;
  }
  return <FlatList {...props} />;
}
