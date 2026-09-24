import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Text } from '@/components/ui/Text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' }}>
        <Ionicons name="alert-circle-outline" size={56} color={Colors.gray[300]} />
        <Text variant="title" style={{ color: '#111827', marginTop: 16, marginBottom: 8 }}>
          Page not found
        </Text>
        <Text variant="body" style={{ color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
          This screen doesn't exist.
        </Text>
        <Link href="/">
          <Text variant="bodyStrong" style={{ color: Colors.primary[600] }}>
            Go to home screen
          </Text>
        </Link>
      </View>
    </>
  );
}
