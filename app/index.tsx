import { useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Splash } from '../components/Shell';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';

/** Signed-out entry: landing page, or the login screen after tapping Sign in / Sign up. */
export default function Index() {
    const { user, isGuest, loading, authError, trySample } = useAuth();
    const [mode, setMode] = useState<'signin' | 'signup' | null>(null);

    if (loading) return <Splash />;
    if (user || isGuest) return <Redirect href="/overview" />;
    // A failed OAuth return lands on the login screen showing the error.
    if (mode !== null || authError) return <LoginScreen initialMode={mode ?? 'signin'} onBack={() => setMode(null)} />;
    return <LandingScreen onSignIn={() => setMode('signin')} onSignUp={() => setMode('signup')} onTrySample={trySample} />;
}
