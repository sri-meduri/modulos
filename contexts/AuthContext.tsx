import React, { createContext, useContext, useEffect, useState } from 'react';
import { Hub } from 'aws-amplify/utils';
import {
    getCurrentUser,
    fetchUserAttributes,
    fetchAuthSession,
    signIn,
    signUp,
    confirmSignUp,
    resendSignUpCode,
    signInWithRedirect,
    signOut as amplifySignOut,
    resetPassword,
    confirmResetPassword,
    updatePassword,
} from 'aws-amplify/auth';
import { storage, purgeAuthStorage } from '../lib/storage';
import '../lib/amplify';

interface AuthUser {
    userId: string;
    email: string | null;
    // Federated (Google) accounts have no Cognito password to change; native
    // accounts do. Derived from the `identities` claim Cognito adds to the ID
    // token for federated sign-ins.
    signInMethod: 'email' | 'google';
}

interface AuthContextType {
    user: AuthUser | null;
    /** True in guest mode AND in sample mode (sample is a read-mostly guest variant). */
    isGuest: boolean;
    /** True when browsing the preloaded sample profile. */
    isSample: boolean;
    loading: boolean;
    pendingAuthMode: 'signin' | 'signup' | null;
    pendingConfirmation: { email: string } | null;
    authError: string | null;
    /** Bumps when local data is wiped, so data providers remount fresh. */
    dataEpoch: number;
    resetData: () => void;
    clearAuthError: () => void;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
    confirmSignUpCode: (email: string, code: string) => Promise<void>;
    resendConfirmationCode: (email: string) => Promise<void>;
    continueAsGuest: () => void;
    trySample: () => void;
    startWithOwnData: () => void;
    signOut: () => Promise<void>;
    openAuth: (mode: 'signin' | 'signup') => void;
    closeAuth: () => void;
    requestPasswordReset: (email: string) => Promise<void>;
    confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const loadCurrentUser = async (): Promise<AuthUser | null> => {
    try {
        const current = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        const session = await fetchAuthSession();
        const hasFederatedIdentity = !!session.tokens?.idToken?.payload?.identities;
        return {
            userId: current.userId,
            email: attributes.email ?? null,
            signInMethod: hasFederatedIdentity ? 'google' : 'email',
        };
    } catch {
        return null;
    }
};

/** Sample data is disposable: it is never imported into an account. */
const clearSampleData = (): void => {
    storage.removeItem('sampleMode');
    storage.removeItem('sample_finances');
    storage.removeItem('sample_settings');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isGuest, setIsGuest] = useState<boolean>(false);
    const [isSample, setIsSample] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [pendingAuthMode, setPendingAuthMode] = useState<'signin' | 'signup' | null>(null);
    const [pendingConfirmation, setPendingConfirmation] = useState<{ email: string } | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [dataEpoch, setDataEpoch] = useState(0);

    useEffect(() => {
        // A real signed-in session always outranks the guest flag: a guest
        // who completes Google/email sign-in must land signed in, not be
        // short-circuited back into guest mode by the leftover flag.
        // (guest_finances/guest_settings stay untouched here so the data
        // layer's import prompt can still offer to migrate them.)
        const wasGuest = storage.getItem('guestMode') === 'true';
        const wasSample = storage.getItem('sampleMode') === 'true';
        loadCurrentUser().then(u => {
            if (u) {
                storage.removeItem('guestMode');
                clearSampleData();
                setIsGuest(false);
                setIsSample(false);
                setUser(u);
            } else if (wasSample) {
                setIsGuest(true);
                setIsSample(true);
            } else if (wasGuest) {
                setIsGuest(true);
            }
            setLoading(false);
        });

        const hubListener = Hub.listen('auth', ({ payload }) => {
            switch (payload.event) {
                case 'signedIn':
                    // Only the guestMode flag is cleared here. guest_finances/guest_settings
                    // (the actual data) are left alone until the data layer's import prompt
                    // resolves, so a guest's local data is never silently discarded.
                    storage.removeItem('guestMode');
                    clearSampleData();
                    setIsGuest(false);
                    setIsSample(false);
                    loadCurrentUser().then(setUser);
                    break;
                case 'signedOut':
                    setUser(null);
                    break;
                case 'signInWithRedirect_failure': {
                    // The OAuth return leg failed (e.g. Cognito couldn't
                    // complete the exchange). Surface it — silently landing
                    // back on the homepage is indistinguishable from a bug.
                    const detail = (payload as { data?: { error?: { message?: string } } }).data?.error?.message;
                    setAuthError(detail || 'Google sign-in could not be completed.');
                    break;
                }
            }
        });

        return () => hubListener();
    }, []);

    const signInWithGoogle = async (): Promise<void> => {
        try {
            await signInWithRedirect({ provider: 'Google' });
        } catch {
            // Any leftover state from an old session or an interrupted
            // sign-in can block a new redirect. Clear everything auth-owned
            // and retry once; only surface an error if the clean retry fails.
            try {
                await amplifySignOut();
            } catch {
                // No signable-out session — fine, purge below handles the rest.
            }
            await purgeAuthStorage();
            await signInWithRedirect({ provider: 'Google' });
        }
    };

    const signInWithEmail = async (email: string, password: string): Promise<void> => {
        const { isSignedIn, nextStep } = await signIn({ username: email, password });
        if (!isSignedIn) {
            if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
                setPendingConfirmation({ email });
                throw new Error('ACCOUNT_NOT_CONFIRMED');
            }
            throw new Error(`Additional sign-in step required: ${nextStep.signInStep}`);
        }
    };

    const signUpWithEmail = async (email: string, password: string): Promise<{ needsConfirmation: boolean }> => {
        try {
            const { isSignUpComplete, nextStep } = await signUp({
                username: email,
                password,
                options: { userAttributes: { email } },
            });
            if (!isSignUpComplete && nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
                setPendingConfirmation({ email });
                return { needsConfirmation: true };
            }
            return { needsConfirmation: false };
        } catch (err) {
            if (err instanceof Error && err.name === 'UsernameExistsException') {
                throw new Error('EMAIL_ALREADY_EXISTS');
            }
            throw err;
        }
    };

    const confirmSignUpCode = async (email: string, code: string): Promise<void> => {
        await confirmSignUp({ username: email, confirmationCode: code });
        setPendingConfirmation(null);
    };

    const resendConfirmationCode = async (email: string): Promise<void> => {
        await resendSignUpCode({ username: email });
    };

    const continueAsGuest = () => {
        storage.setItem('guestMode', 'true');
        setIsGuest(true);
        setPendingAuthMode(null);
    };

    const trySample = () => {
        // Start from a fresh copy of the sample profile every time.
        clearSampleData();
        storage.setItem('sampleMode', 'true');
        setIsGuest(true);
        setIsSample(true);
        setPendingAuthMode(null);
    };

    // Leaves the sample and drops into a regular (empty or previously saved) guest session.
    const startWithOwnData = () => {
        clearSampleData();
        storage.setItem('guestMode', 'true');
        setIsSample(false);
        setIsGuest(true);
    };

    const openAuth = (mode: 'signin' | 'signup') => {
        setPendingAuthMode(mode);
    };

    const closeAuth = () => {
        setPendingAuthMode(null);
    };

    const requestPasswordReset = async (email: string): Promise<void> => {
        await resetPassword({ username: email });
    };

    const confirmPasswordReset = async (email: string, code: string, newPassword: string): Promise<void> => {
        await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
    };

    const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
        await updatePassword({ oldPassword, newPassword });
    };

    const signOut = async (): Promise<void> => {
        if (isSample) {
            clearSampleData();
            setIsSample(false);
            setIsGuest(false);
        } else if (isGuest) {
            storage.removeItem('guestMode');
            storage.removeItem('guest_finances');
            storage.removeItem('guest_settings');
            setIsGuest(false);
        } else {
            await amplifySignOut();
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user, isGuest, isSample, loading, pendingAuthMode, pendingConfirmation,
            authError, clearAuthError: () => setAuthError(null), dataEpoch, resetData: () => setDataEpoch(e => e + 1),
            signInWithGoogle, signInWithEmail, signUpWithEmail, confirmSignUpCode, resendConfirmationCode,
            continueAsGuest, trySample, startWithOwnData, signOut, openAuth, closeAuth,
            requestPasswordReset, confirmPasswordReset, changePassword,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
