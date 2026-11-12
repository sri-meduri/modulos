import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { useBanks } from '../hooks/useBanks';
import { Button, Card, Field, Icon, ICONS, PageTitle, Section, Sheet } from '../components/ui';
import { appEnvLabel } from '../lib/env';
import { backendLabel } from '../lib/amplify';

const PASSWORD_REQUIREMENTS = 'Password must be at least 8 characters and include uppercase and lowercase letters, a number, and a special character (e.g. !@#$%).';

const ProfilePage: React.FC = () => {
    const { user, isGuest, isSample, signOut, openAuth, changePassword } = useAuth();
    const { deleteAllData } = useFinance();
    const { banks, signedIn } = useBanks();
    const [pwOpen, setPwOpen] = useState(false);
    const [cur, setCur] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const attention = banks.filter(b => b.needsAttention).length;
    const initial = (user?.email ?? 'G').charAt(0).toUpperCase();
    const isEmailUser = user?.signInMethod === 'email';
    const env = appEnvLabel();

    const updatePassword = async () => {
        setMsg(null);
        if (!cur) return setMsg({ ok: false, text: 'Enter your current password.' });
        if (next.length < 8) return setMsg({ ok: false, text: PASSWORD_REQUIREMENTS });
        if (next !== confirm) return setMsg({ ok: false, text: 'Passwords do not match.' });
        try {
            setBusy(true);
            await changePassword(cur, next);
            setMsg({ ok: true, text: 'Password updated.' });
            setCur(''); setNext(''); setConfirm('');
        } catch (err) {
            const m = err instanceof Error ? err.message.toLowerCase() : '';
            setMsg({ ok: false, text: m.includes('different') || m.includes('same password') || m.includes('old password')
                ? 'Your new password must differ from the current one.'
                : m.includes('password') ? PASSWORD_REQUIREMENTS : 'Could not update the password. Sign out and back in, then try again.' });
        } finally { setBusy(false); }
    };

    const handleDelete = async () => {
        if (window.confirm('Delete all your data? This cannot be undone.')) {
            await deleteAllData();
            window.location.reload();
        }
    };
    const handleSignOut = async () => {
        if (window.confirm(isGuest && !isSample ? 'Sign out? Data stored only on this device will be removed.' : 'Sign out?')) {
            await signOut();
            window.location.reload();
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <PageTitle>Profile</PageTitle>

            <Card className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#12211E] border border-[#1F4A40] flex items-center justify-center text-lg font-bold text-accent">{isGuest ? '?' : initial}</div>
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-base font-semibold truncate">{isSample ? 'Sample profile' : isGuest ? 'Guest' : user?.email ?? 'Your account'}</span>
                    <span className="text-[13px] text-dark-text-secondary">{isSample ? 'Example data, nothing is saved' : isGuest ? 'Your data stays on this device' : 'Plan saved and synced'}</span>
                </div>
            </Card>

            {isGuest && (
                <Card tone="mint" className="flex flex-col gap-3">
                    <span className="font-semibold">What an account adds</span>
                    <ul className="list-disc pl-5 text-sm text-[#B8C2CF] flex flex-col gap-1">
                        <li>Your plan is saved and syncs across devices</li>
                        <li>Optional bank connection to fill in income, debts and payments</li>
                        <li>Backup if you clear your browser</li>
                    </ul>
                    <div className="flex gap-2.5">
                        <Button className="flex-1" onClick={() => openAuth('signup')}>Create account</Button>
                        <Button variant="secondary" onClick={() => openAuth('signin')}>Sign in</Button>
                    </div>
                </Card>
            )}

            <Link to="/profile/accounts">
                <Card className={`flex items-center justify-between ${attention ? 'border-amber/60' : 'border-accent/60'}`}>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold">Linked accounts</span>
                        <span className="text-[13px] text-dark-text-secondary">
                            {!signedIn ? 'Create an account to connect a bank' : banks.length === 0 ? 'None connected' : `${banks.length - attention} connected${attention ? ` · ${attention} needs attention` : ''}`}
                        </span>
                    </div>
                    <Icon d={ICONS.chevron} className="w-5 h-5 text-dark-text-secondary" />
                </Card>
            </Link>

            {!isGuest && isEmailUser && (
                <Button variant="secondary" onClick={() => setPwOpen(true)}>Change password</Button>
            )}

            <Section title="Data and privacy">
                <Card className="flex flex-col gap-3 text-sm text-dark-text-secondary">
                    <p>Modulos shows general educational guidance, not financial advice. We never sell your data, and bank access is read-only.</p>
                    <a href="/privacy" className="text-accent underline w-fit">Privacy policy</a>
                    <Button variant="danger" onClick={handleDelete}>Delete all my data</Button>
                </Card>
            </Section>

            <Button variant="secondary" onClick={handleSignOut}>{isGuest ? 'Leave' : 'Sign out'}</Button>
            {env && <p className="text-xs text-center text-amber">Environment: {env} · backend {backendLabel}</p>}

            <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change password">
                {msg && <p role="alert" className={`text-sm ${msg.ok ? 'text-accent' : 'text-risk'}`}>{msg.text}</p>}
                <Field label="Current password" type="password" inputMode="text" value={cur} onChange={setCur} />
                <Field label="New password" type="password" inputMode="text" value={next} onChange={setNext} />
                <Field label="Confirm new password" type="password" inputMode="text" value={confirm} onChange={setConfirm} />
                <Button size="lg" disabled={busy || !next || !confirm} onClick={updatePassword}>{busy ? 'Updating…' : 'Update password'}</Button>
            </Sheet>
        </div>
    );
};

export default ProfilePage;
