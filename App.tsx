import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FinanceProvider, useFinance } from './contexts/FinanceContext';
import { Icon, ICONS } from './components/ui';
import { appEnvLabel } from './lib/env';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';

const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const DebtsPage = lazy(() => import('./pages/DebtsPage'));
const TestLoanPage = lazy(() => import('./pages/TestLoanPage'));
const PlanPage = lazy(() => import('./pages/PlanPage'));
const BudgetPage = lazy(() => import('./pages/BudgetPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LinkedAccountsPage = lazy(() => import('./pages/LinkedAccountsPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

const AppContent: React.FC = () => {
    const { user, isGuest, isSample, loading, pendingAuthMode, trySample, authError } = useAuth();
    const [preAuthMode, setPreAuthMode] = useState<'signin' | 'signup' | null>(null);

    // Publicly reachable regardless of auth state (linked from the Plaid
    // application and external consent screens).
    if (window.location.pathname === '/privacy') {
        return <PrivacyPage />;
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-dark-bg">
                <p className="text-lg text-dark-text-secondary">Loading...</p>
            </div>
        );
    }

    if (!user && !isGuest) {
        // A failed OAuth return should land on the login screen showing the
        // error, not bounce silently to the marketing page.
        if (preAuthMode !== null || authError) {
            return <LoginPage initialMode={preAuthMode ?? 'signin'} onBack={() => setPreAuthMode(null)} />;
        }
        return (
            <LandingPage
                onSignIn={() => setPreAuthMode('signin')}
                onSignUp={() => setPreAuthMode('signup')}
                onTrySample={trySample}
            />
        );
    }

    if (isGuest && pendingAuthMode !== null) {
        return <LoginPage initialMode={pendingAuthMode} />;
    }

    return (
        <FinanceProvider key={isSample ? 'sample' : 'live'}>
            <MainApp />
        </FinanceProvider>
    );
};

const AppHeader: React.FC = () => {
    const { user, isGuest, isSample, signOut, openAuth } = useAuth();
    const env = appEnvLabel();

    return (
        <header className="fixed top-0 left-0 right-0 bg-dark-bg/95 backdrop-blur border-b border-dark-border px-4 py-2.5 z-50">
            <div className="max-w-xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {isGuest && (
                        <button onClick={() => signOut()} className="flex items-center gap-1 text-sm text-dark-text-secondary hover:text-dark-text" aria-label="Back to landing page">
                            <Icon d={ICONS.back} className="w-4 h-4" />Back
                        </button>
                    )}
                    <Link to="/overview" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="/Modulos_Logo_Light.png" alt="Modulos" className="h-9 w-auto object-contain" />
                        <span className="hidden sm:inline text-sm font-semibold text-accent tracking-wide">Modulos</span>
                    </Link>
                    {env && <span className="text-[11px] font-bold tracking-wider rounded-full bg-amber text-dark-bg px-2 py-0.5" title="This build is connected to a test backend, not the live app">{env}</span>}
                </div>
                <div className="flex items-center gap-2">
                    {isGuest ? (
                        <>
                            <button onClick={() => openAuth('signin')} className="text-[13px] whitespace-nowrap font-medium text-dark-text-secondary hover:text-dark-text border border-dark-border rounded-lg px-2.5 py-1.5">Sign In</button>
                            <button onClick={() => openAuth('signup')} className="text-[13px] whitespace-nowrap font-semibold bg-accent text-dark-bg rounded-lg px-2.5 py-1.5 hover:bg-accent-hover">Sign Up</button>
                        </>
                    ) : null}
                    <NavLink to="/profile" aria-label="Profile"
                        className={({ isActive }) => `w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold ${isActive ? 'border-accent text-accent bg-[#12211E]' : 'border-dark-border text-dark-text-secondary hover:text-dark-text'}`}>
                        {isGuest ? <Icon d={['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 20a8 8 0 0116 0']} className="w-5 h-5" /> : (user?.email ?? 'U').charAt(0).toUpperCase()}
                    </NavLink>
                </div>
            </div>
        </header>
    );
};

/** Shown while browsing the sample profile; its data is disposable. */
const SampleBanner: React.FC = () => {
    const { startWithOwnData, openAuth } = useAuth();
    return (
        <div className="bg-[#12211E] border border-[#1F4A40] rounded-2xl px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
            <span><strong className="text-accent">Sample data.</strong> This is an example household. Replace it with yours.</span>
            <span className="flex items-center gap-3">
                <button onClick={startWithOwnData} className="font-semibold text-accent hover:underline">Use my own data</button>
                <button onClick={() => openAuth('signup')} className="font-medium text-dark-text-secondary hover:text-dark-text">Sign up</button>
            </span>
        </div>
    );
};

const navItems = [
    { path: '/overview', label: 'Overview', icon: ICONS.overview },
    { path: '/debts', label: 'Debts', icon: ICONS.debts },
    { path: '/plan', label: 'Plan', icon: ICONS.plan },
    { path: '/budget', label: 'Budget', icon: ICONS.budget },
    { path: '/progress', label: 'Progress', icon: ICONS.progress },
];

const MainApp: React.FC = () => {
    const { loading, settings, finances } = useFinance();
    const { isSample, isGuest } = useAuth();

    const loadingFallback = (
        <div className="flex justify-center items-center h-screen">
            <p className="text-lg text-dark-text-secondary">Loading...</p>
        </div>
    );

    if (loading) return loadingFallback;

    // First run: nothing entered yet and the flow wasn't finished or skipped.
    const needsOnboarding = !isSample && !settings.onboardingDone && finances.loans.length === 0 && finances.monthlyNetIncome === 0;

    if (needsOnboarding) {
        return (
            <BrowserRouter>
                <Suspense fallback={loadingFallback}><OnboardingPage /></Suspense>
            </BrowserRouter>
        );
    }

    return (
        <BrowserRouter>
            <div className="flex flex-col min-h-screen bg-dark-bg text-dark-text font-sans">
                <AppHeader />
                <main className="flex-grow pt-16 pb-32">
                    <div className="max-w-xl mx-auto px-5 sm:px-6 flex flex-col gap-4">
                        {isSample && <SampleBanner />}
                        {isGuest && !isSample && (
                            <div className="text-xs text-dark-text-secondary flex items-center gap-1.5"><Icon d={ICONS.lock} className="w-3.5 h-3.5" />Your data stays on this device. Sign up to save and sync it.</div>
                        )}
                        <Suspense fallback={loadingFallback}>
                            <Routes>
                                <Route path="/" element={<Navigate to="/overview" replace />} />
                                <Route path="/overview" element={<OverviewPage />} />
                                <Route path="/debts" element={<DebtsPage />} />
                                <Route path="/debts/test" element={<TestLoanPage />} />
                                <Route path="/plan" element={<PlanPage />} />
                                <Route path="/budget" element={<BudgetPage />} />
                                <Route path="/progress" element={<ProgressPage />} />
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/profile/accounts" element={<LinkedAccountsPage />} />
                                {/* Plaid's registered OAuth return path; it resumes Link from Linked accounts. */}
                                <Route path="/finances" element={<LinkedAccountsPage />} />
                                <Route path="/loan-check" element={<Navigate to="/debts/test" replace />} />
                                <Route path="/payoff-plan" element={<Navigate to="/plan" replace />} />
                                <Route path="/settings" element={<Navigate to="/profile" replace />} />
                                <Route path="*" element={<Navigate to="/overview" replace />} />
                            </Routes>
                        </Suspense>
                        <div className="text-center text-xs text-dark-text-secondary pt-4">
                            General educational guidance only. Not financial advice.
                        </div>
                    </div>
                </main>
                <footer className="fixed bottom-0 left-0 right-0 bg-nav border-t border-dark-border z-50 pb-[env(safe-area-inset-bottom)]">
                    <nav className="max-w-xl mx-auto flex justify-around pt-2.5 pb-3" aria-label="Main">
                        {navItems.map(({ path, label, icon }) => (
                            <NavLink key={path} to={path}
                                className={({ isActive }) => `flex flex-col items-center gap-1 w-16 text-[11px] transition-colors ${isActive ? 'text-accent font-semibold' : 'text-dark-text-secondary hover:text-dark-text font-medium'}`}>
                                <Icon d={icon} className="w-6 h-6" />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </footer>
            </div>
        </BrowserRouter>
    );
};

/** Surfaces cloud-save failures (dispatched by useAmplifyStorage) as a banner. */
const SaveErrorBanner: React.FC = () => {
    const [message, setMessage] = useState<string | null>(null);
    React.useEffect(() => {
        const handler = (e: Event) => setMessage((e as CustomEvent<string>).detail);
        window.addEventListener('modulos:save-error', handler);
        return () => window.removeEventListener('modulos:save-error', handler);
    }, []);
    if (!message) return null;
    return (
        <div className="fixed top-0 inset-x-0 z-[60] bg-red-900/90 text-red-100 text-sm px-4 py-2 flex items-start justify-between gap-3">
            <span><strong>Couldn't save to the cloud:</strong> {message}</span>
            <button onClick={() => setMessage(null)} className="text-red-200 hover:text-white font-bold px-2">×</button>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <SaveErrorBanner />
            <AppContent />
        </AuthProvider>
    );
};

export default App;
