import { Screen, Text, Button, Spacer } from '@/components/ui';
import { useRouter } from 'expo-router';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text variant="h1">404</Text>
      <Text>Whoops, this page drifted away.</Text>
      <Spacer />
      <Button title="Go to Board" onPress={() => router.replace('/(main)/board')} />
    </Screen>
  );
}
