import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Inline, Screen, Stack, Text, TextButton } from '../components/ui';
import { Image } from 'react-native';

const logo = require('../assets/logo.png');

interface LoginScreenProps {
    initialMode?: 'signin' | 'signup';
    onBack?: () => void;
}

type ForgotView = 'auth' | 'forgot-email' | 'forgot-code';

const LoginScreen: React.FC<LoginScreenProps> = ({ initialMode, onBack }) => {
    const {
        signInWithGoogle, signInWithEmail, signUpWithEmail, confirmSignUpCode, resendConfirmationCode,
        continueAsGuest, isGuest, closeAuth, requestPasswordReset, confirmPasswordReset, pendingConfirmation,
        authError, clearAuthError,
    } = useAuth();
    const [error, setError] = useState<string | null>(null);

    // Surface OAuth return-leg failures (e.g. the Cognito/Google exchange
    // failing after the redirect back) that would otherwise be invisible.
    useEffect(() => {
        if (authError) {
            setError(`Google sign-in failed: ${authError}`);
            clearAuthError();
        }
    }, [authError, clearAuthError]);
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
    const [view, setView] = useState<ForgotView>('auth');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [signUpCode, setSignUpCode] = useState('');
    const [resendStatus, setResendStatus] = useState<'idle' | 'sent'>('idle');

    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [resetConfirmPassword, setResetConfirmPassword] = useState('');
    const [resetDone, setResetDone] = useState(false);

    const getErrorMessage = (err: unknown): string =>
        err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : '');

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            setError(null);
            await signInWithGoogle();
        } catch (err) {
            const detail = getErrorMessage(err);
            setError(detail ? `Failed to sign in with Google: ${detail}` : 'Failed to sign in with Google. Please try again.');
            setLoading(false);
        }
    };

    const handleEmailAuth = async () => {
        try {
            setLoading(true);
            setError(null);
            if (isSignUp) {
                const { needsConfirmation } = await signUpWithEmail(email, password);
                if (!needsConfirmation) {
                    await signInWithEmail(email, password);
                }
                // else: context's pendingConfirmation is now set, view switches to code entry below
            } else {
                await signInWithEmail(email, password);
            }
        } catch (err) {
            const msg = getErrorMessage(err);
            if (isSignUp && msg === 'EMAIL_ALREADY_EXISTS') {
                setIsSignUp(false);
                setError('An account with this email already exists. Please sign in instead.');
            } else if (msg === 'ACCOUNT_NOT_CONFIRMED') {
                // pendingConfirmation was set in context; code-entry view takes over
            } else if (msg) {
                setError(msg);
            } else {
                setError(isSignUp ? 'Failed to create account. Please try again.' : 'Invalid email or password.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmSignUpCode = async () => {
        if (!pendingConfirmation) return;
        try {
            setLoading(true);
            setError(null);
            await confirmSignUpCode(pendingConfirmation.email, signUpCode);
            await signInWithEmail(pendingConfirmation.email, password);
        } catch (err) {
            setError(getErrorMessage(err) || 'Invalid or expired code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!pendingConfirmation) return;
        try {
            setError(null);
            await resendConfirmationCode(pendingConfirmation.email);
            setResendStatus('sent');
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to resend code.');
        }
    };

    const handleGuestContinue = () => {
        continueAsGuest();
    };

    const handleRequestReset = async () => {
        if (!resetEmail) {
            setError('Please enter your email address first.');
            return;
        }
        try {
            setLoading(true);
            setError(null);
            await requestPasswordReset(resetEmail);
            setView('forgot-code');
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to send reset code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReset = async () => {
        setError(null);
        if (resetNewPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (resetNewPassword !== resetConfirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        try {
            setLoading(true);
            await confirmPasswordReset(resetEmail, resetCode, resetNewPassword);
            setResetDone(true);
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to reset password. The code may have expired.');
        } finally {
            setLoading(false);
        }
    };

    const Frame: React.FC<{ children: React.ReactNode; backAction?: () => void; backLabel?: string }> = ({ children, backAction, backLabel }) => (
        <Screen narrow>
            <View style={{ height: 24 }} />
            {backAction ? <TextButton color="textMuted" onPress={backAction}>{`‹ ${backLabel ?? 'Back'}`}</TextButton> : null}
            <Stack gap="sm" align="center">
                <Image source={logo} style={{ width: 96, height: 70 }} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text variant="h1" accessibilityRole="header">Modulos</Text>
                <Text color="textMuted" align="center">Your Personal Debt Management Companion</Text>
            </Stack>
            <Card gap="lg" pad="roomy">{children}</Card>
        </Screen>
    );

    const ErrorNote = error ? <Card tone="amber" accessibilityRole="alert"><Text variant="small" color="risk">{error}</Text></Card> : null;

    // --- Sign-up confirmation code ---
    if (pendingConfirmation) {
        return (
            <Frame>
                <Stack gap="sm">
                    <Text variant="h2">Enter confirmation code</Text>
                    <Text variant="small" color="textMuted">We sent a 6-digit code to <Text variant="smallStrong">{pendingConfirmation.email}</Text>. Enter it below to activate your account.</Text>
                </Stack>
                {ErrorNote}
                {resendStatus === 'sent' ? <Card tone="mint"><Text variant="small" color="accent">A new code has been sent.</Text></Card> : null}
                <Inline><Field label="Confirmation code" keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" value={signUpCode} onChange={setSignUpCode} placeholder="6-digit code" /></Inline>
                <Button size="lg" loading={loading} disabled={!signUpCode} onPress={handleConfirmSignUpCode}>Confirm</Button>
                <TextButton onPress={handleResendCode}>Resend code</TextButton>
            </Frame>
        );
    }

    // --- Forgot password: ask for email ---
    if (view === 'forgot-email') {
        return (
            <Frame backAction={() => { setView('auth'); setError(null); }} backLabel="Back to sign in">
                <Stack gap="sm">
                    <Text variant="h2">Reset password</Text>
                    <Text variant="small" color="textMuted">Enter your email and we'll send you a code to reset your password.</Text>
                </Stack>
                {ErrorNote}
                <Inline><Field label="Email" keyboardType="email-address" autoComplete="email" value={resetEmail} onChange={setResetEmail} placeholder="Email" /></Inline>
                <Button size="lg" loading={loading} disabled={!resetEmail} onPress={handleRequestReset}>Send reset code</Button>
            </Frame>
        );
    }

    // --- Forgot password: code + new password ---
    if (view === 'forgot-code') {
        return (
            <Frame backAction={() => { setView('forgot-email'); setError(null); setResetDone(false); }} backLabel="Back">
                {resetDone ? (
                    <>
                        <Stack gap="sm"><Text variant="h2" color="accent">Password updated successfully</Text><Text variant="small" color="textMuted">You can now sign in with your new password.</Text></Stack>
                        <Button size="lg" onPress={() => { setView('auth'); setResetDone(false); setResetCode(''); setResetNewPassword(''); setResetConfirmPassword(''); setIsSignUp(false); }}>Back to sign in</Button>
                    </>
                ) : (
                    <>
                        <Stack gap="sm">
                            <Text variant="h2">Set new password</Text>
                            <Text variant="small" color="textMuted">Enter the code we sent to <Text variant="smallStrong">{resetEmail}</Text> and choose a new password.</Text>
                        </Stack>
                        {ErrorNote}
                        <Inline><Field label="Code" keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" value={resetCode} onChange={setResetCode} placeholder="6-digit code" /></Inline>
                        <Inline><Field label="New password" secure autoComplete="new-password" value={resetNewPassword} onChange={setResetNewPassword} placeholder="Min. 8 characters" /></Inline>
                        <Inline><Field label="Confirm new password" secure autoComplete="new-password" value={resetConfirmPassword} onChange={setResetConfirmPassword} placeholder="Repeat new password" /></Inline>
                        <Button size="lg" loading={loading} disabled={!resetCode || !resetNewPassword || !resetConfirmPassword} onPress={handleConfirmReset}>Reset password</Button>
                    </>
                )}
            </Frame>
        );
    }

    // --- Sign in / sign up ---
    return (
        <Frame backAction={onBack ?? (isGuest ? closeAuth : undefined)} backLabel={onBack ? 'Back to home' : 'Back to app'}>
            <Stack gap="sm">
                <Text variant="h2">{isSignUp ? 'Create your account' : 'Welcome'}</Text>
                <Text variant="small" color="textMuted">Sign in to sync your data across devices{isGuest ? '.' : ' or continue as a guest.'}</Text>
            </Stack>
            {ErrorNote}
            <Button variant="secondary" size="lg" loading={loading} onPress={handleGoogleSignIn}>Continue with Google</Button>
            <Inline><Field label="Email" keyboardType="email-address" autoComplete="email" value={email} onChange={setEmail} placeholder="Email" /></Inline>
            <Inline><Field label="Password" secure autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={setPassword} placeholder="Password" onSubmit={handleEmailAuth} /></Inline>
            {!isSignUp ? <TextButton onPress={() => { setResetEmail(email); setView('forgot-email'); setError(null); }}>Forgot password?</TextButton> : null}
            <Button size="lg" loading={loading} disabled={!email || !password} onPress={handleEmailAuth}>{isSignUp ? 'Create account' : 'Sign in'}</Button>
            {isSignUp ? <Text variant="caption" color="textMuted">Password must be at least 8 characters and include uppercase and lowercase letters, a number, and a special character.</Text> : null}
            <TextButton onPress={() => { setIsSignUp(!isSignUp); setError(null); }}>{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}</TextButton>
            {!isGuest ? (
                <Stack gap="sm">
                    <Button variant="ghost" onPress={handleGuestContinue}>Continue as guest</Button>
                    <Text variant="caption" color="textMuted" align="center">Guest mode stores data locally on your device only.</Text>
                </Stack>
            ) : <Text variant="caption" color="textMuted" align="center">Sign in to sync across devices.</Text>}
        </Frame>
    );
};

export default LoginScreen;
