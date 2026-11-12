import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { AuthProvider } from '../contexts/AuthContext';
import { hydrateStorage } from '../lib/storage';
import { SaveErrorBanner, Splash } from '../components/Shell';

export default function RootLayout() {
    const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
    const [storageReady, setStorageReady] = useState(false);
    useEffect(() => { hydrateStorage().then(() => setStorageReady(true)); }, []);

    if (!fontsLoaded || !storageReady) return <Splash />;
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <StatusBar style="light" />
                <SaveErrorBanner />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
            </AuthProvider>
        </SafeAreaProvider>
    );
}
