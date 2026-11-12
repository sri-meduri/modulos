import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { colors } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { useBanks } from '../hooks/useBanks';
import { appEnvLabel } from '../lib/env';
import { backendLabel } from '../lib/amplify';
import { confirmAction } from '../lib/dialog';
import { Avatar, Button, Card, Field, Icon, Inline, PageTitle, Screen, Section, SegTabs, Sheet, Stack, Text, TextButton } from '../components/ui';
import { RISK_LABELS } from '../services/loanTest';
import { RiskProfile } from '../types';

const PASSWORD_REQUIREMENTS = 'Password must be at least 8 characters and include uppercase and lowercase letters, a number, and a special character (e.g. !@#$%).';

const ProfileScreen: React.FC = () => {
    const router = useRouter();
    const { user, isGuest, isSample, signOut, openAuth, changePassword } = useAuth();
    const { deleteAllData, settings, setSettings } = useFinance();
    const { banks, signedIn } = useBanks();
    const [pwOpen, setPwOpen] = useState(false);
    const [cur, setCur] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const attention = banks.filter(b => b.needsAttention).length;
    const initial = (user?.email ?? 'G').charAt(0).toUpperCase();
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
        if (await confirmAction('Delete all your data?', 'This cannot be undone.', 'Delete', true)) await deleteAllData();
    };
    const handleSignOut = async () => {
        const warn = isGuest && !isSample ? 'Data stored only on this device will be removed.' : '';
        if (await confirmAction(isGuest ? 'Leave?' : 'Sign out?', warn, isGuest ? 'Leave' : 'Sign out')) {
            await signOut();
            router.replace('/');
        }
    };

    return (
        <Screen narrow>
            <PageTitle>Profile</PageTitle>

            <Card>
                <Inline gap="lg">
                    <Avatar letter={isGuest ? '?' : initial} />
                    <Stack gap="xs" style={{ flex: 1 }}>
                        <Text variant="h3" numberOfLines={1}>{isSample ? 'Sample profile' : isGuest ? 'Guest' : user?.email ?? 'Your account'}</Text>
                        <Text variant="label" color="textMuted">{isSample ? 'Example data, nothing is saved' : isGuest ? 'Your data stays on this device' : 'Plan saved and synced'}</Text>
                    </Stack>
                </Inline>
            </Card>

            {isGuest ? (
                <Card tone="mint" gap="md">
                    <Text variant="bodyStrong">What an account adds</Text>
                    <Stack gap="xs">
                        <Text variant="small" color="textMuted">• Your plan is saved and syncs across devices</Text>
                        <Text variant="small" color="textMuted">• Optional bank connection to fill in income, debts and payments</Text>
                        <Text variant="small" color="textMuted">• Backup if you clear your browser</Text>
                    </Stack>
                    <Inline gap="md"><Button compact onPress={() => openAuth('signup')}>Create account</Button><Button variant="secondary" compact onPress={() => openAuth('signin')}>Sign in</Button></Inline>
                </Card>
            ) : null}

            <Card accent={!attention} onPress={() => router.push('/profile/accounts')} style={attention ? { borderColor: colors.amber } : undefined}>
                <Inline justify="space-between">
                    <Stack gap="xs" style={{ flex: 1 }}>
                        <Text variant="bodyStrong">Linked accounts</Text>
                        <Text variant="label" color="textMuted">{!signedIn ? 'Create an account to connect a bank' : banks.length === 0 ? 'None connected' : `${banks.length - attention} connected${attention ? ` · ${attention} needs attention` : ''}`}</Text>
                    </Stack>
                    <Icon name="chevron" size={20} color="textMuted" />
                </Inline>
            </Card>

            <Section title="Risk profile">
                <Card gap="md">
                    <Text variant="small" color="textMuted">Sets the debt-to-income limit used when you test a new loan and on your Overview.</Text>
                    <SegTabs label="Risk profile" value={settings.riskProfile} options={[RiskProfile.Low, RiskProfile.Average, RiskProfile.High].map(v => ({ value: v, label: `${RISK_LABELS[v].label} · ${RISK_LABELS[v].percent}` }))} onChange={v => setSettings(p => ({ ...p, riskProfile: v }))} />
                    <Text variant="caption" color="textMuted">{RISK_LABELS[settings.riskProfile].blurb}</Text>
                </Card>
            </Section>

            {!isGuest && user?.signInMethod === 'email' ? <Button variant="secondary" onPress={() => setPwOpen(true)}>Change password</Button> : null}

            <Section title="Data and privacy">
                <Card gap="md">
                    <Text variant="small" color="textMuted">Modulos shows general educational guidance, not financial advice. We never sell your data, and bank access is read-only.</Text>
                    <TextButton onPress={() => router.push('/privacy')}>Privacy policy</TextButton>
                    <Button variant="danger" onPress={handleDelete}>Delete all my data</Button>
                </Card>
            </Section>

            <Section title="About Modulos">
                <Card gap="sm">
                    <Text variant="small" color="textMuted">Modulos helps you decide whether a loan is affordable before you borrow, and pay your debts off faster after you do. It works with no bank login; connecting a bank is optional.</Text>
                    <Text variant="small" color="textMuted">• Loan affordability with debt-to-income and a safe / borderline / not-recommended verdict</Text>
                    <Text variant="small" color="textMuted">• Avalanche, Snowball or custom payoff plans, with what-ifs</Text>
                    <Text variant="small" color="textMuted">• A tax-aware take-home calculator and a budget that shows where your money goes</Text>
                </Card>
            </Section>

            <Button variant="secondary" onPress={handleSignOut}>{isGuest ? 'Leave' : 'Sign out'}</Button>
            {env ? <Text variant="caption" color="amber" align="center">Environment: {env} · backend {backendLabel}</Text> : null}

            <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change password">
                {msg ? <Text variant="small" color={msg.ok ? 'accent' : 'risk'} accessibilityRole="alert">{msg.text}</Text> : null}
                <Inline><Field label="Current password" secure autoComplete="current-password" value={cur} onChange={setCur} /></Inline>
                <Inline><Field label="New password" secure autoComplete="new-password" value={next} onChange={setNext} /></Inline>
                <Inline><Field label="Confirm new password" secure autoComplete="new-password" value={confirm} onChange={setConfirm} /></Inline>
                <Button size="lg" loading={busy} disabled={!next || !confirm} onPress={updatePassword}>Update password</Button>
            </Sheet>
        </Screen>
    );
};

export default ProfileScreen;
