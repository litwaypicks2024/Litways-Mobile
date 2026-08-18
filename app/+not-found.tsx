import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' }}>
        <Ionicons name="alert-circle-outline" size={56} color={Colors.gray[300]} />
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8 }}>
          Page not found
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
          This screen doesn't exist.
        </Text>
        <Link href="/">
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary[600] }}>
            Go to home screen
          </Text>
        </Link>
      </View>
    </>
  );
}
