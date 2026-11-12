import React from 'react';
import { View } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { colors } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { FinanceProvider, useFinance } from '../../contexts/FinanceContext';
import { BottomBar, ContentColumn, MobileHeader, SampleBanner, Sidebar, Splash, useShellMode } from '../../components/Shell';
import LoginScreen from '../../screens/LoginScreen';
import OnboardingScreen from '../../screens/OnboardingScreen';

const Shell: React.FC = () => {
    const { loading, settings, finances } = useFinance();
    const { isSample } = useAuth();
    const mode = useShellMode();
    if (loading) return <Splash />;

    // First run: nothing entered yet and the flow wasn't finished or skipped.
    if (!isSample && !settings.onboardingDone && finances.loans.length === 0 && finances.monthlyNetIncome === 0) return <OnboardingScreen />;

    return (
        <View style={{ flex: 1, flexDirection: mode === 'sidebar' ? 'row' : 'column', backgroundColor: colors.bg }}>
            {mode === 'sidebar' ? <Sidebar /> : <MobileHeader />}
            <View style={{ flex: 1 }}>
                {isSample ? <ContentColumn><SampleBanner /></ContentColumn> : null}
                <Slot />
            </View>
            {mode === 'tabs' ? <BottomBar /> : null}
        </View>
    );
};

export default function AppLayout() {
    const { user, isGuest, isSample, loading, pendingAuthMode, dataEpoch } = useAuth();
    if (loading) return <Splash />;
    if (!user && !isGuest) return <Redirect href="/" />;
    // A guest tapped Sign in / Sign up: show the login screen over the app.
    if (isGuest && pendingAuthMode !== null) return <LoginScreen initialMode={pendingAuthMode} />;
    return (
        <FinanceProvider key={`${isSample ? 'sample' : 'live'}-${dataEpoch}`}>
            <Shell />
        </FinanceProvider>
    );
}
