import React, { useCallback, useEffect, useState } from 'react';
import { client } from '../lib/amplify';
import { storage } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { parseSyncResult, PlaidImport } from '../services/plaidSync';
import { clearOAuthParams, isOAuthReturn, oauthRedirectUri, PlaidInstitution, usePlaidLauncher } from '../lib/plaidLink';
import { Button, Icon, Inline, Sheet, Stack, Text } from './ui';
import { IconName } from '../theme';

type Status = 'idle' | 'preparing' | 'linking' | 'importing';

const OAUTH_TOKEN_KEY = 'plaid_oauth_link_token';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Props {
    onImported?: (imported: PlaidImport) => void;
    /** Button face. */
    children?: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'md' | 'lg';
    /** Reconnect an existing item (Plaid update mode). */
    itemId?: string;
}

const Point: React.FC<{ icon: IconName; title: string; children: string }> = ({ icon, title, children }) => (
    <Inline align="flex-start" gap="md">
        <Icon name={icon} size={20} color="accent" />
        <Text variant="small" style={{ flex: 1 }}><Text variant="smallStrong">{title} </Text>{children}</Text>
    </Inline>
);

/**
 * Connect-a-bank flow: trust screen -> createPlaidLinkToken -> Plaid Link ->
 * exchangePlaidPublicToken -> syncPlaidData -> merge into finances.
 *
 * Guests cannot link (the connection is stored server-side), so they get a
 * "create an account" prompt instead of Link.
 */
const PlaidLinkButton: React.FC<Props> = ({ onImported, children = 'Connect with Plaid', variant = 'primary', size = 'lg', itemId }) => {
    const { user, isGuest, openAuth } = useAuth();
    const { applyBankSync } = useFinance();
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [hint, setHint] = useState<string | null>(null);
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [oauthResume, setOauthResume] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    const isSignedIn = !!user && !isGuest;

    const finish = useCallback(() => {
        setStatus('idle'); setHint(null); setLinkToken(null); setOauthResume(false);
        storage.removeItem(OAUTH_TOKEN_KEY);
        clearOAuthParams();
    }, []);

    const onSuccess = useCallback(async (publicToken: string, institution: PlaidInstitution) => {
        setStatus('importing');
        setError(null);
        try {
            let syncItemId = itemId;
            if (!itemId) {
                const { data: exchange, errors } = await client.mutations.exchangePlaidPublicToken({ publicToken, institutionId: institution.id, institutionName: institution.name });
                if (errors?.length || !exchange) throw new Error(errors?.[0]?.message ?? 'Bank connection failed');
                syncItemId = exchange.itemId;
            }
            // Plaid extracts data asynchronously after a new connection: poll until something lands (~45s max).
            let last: PlaidImport | null = null;
            for (let attempt = 0; attempt < 12; attempt++) {
                if (attempt > 0) await sleep(4000);
                const { data: sync, errors } = await client.mutations.syncPlaidData({ itemId: syncItemId });
                if (errors?.length) throw new Error(errors[0].message);
                const imported = parseSyncResult(sync);
                last = imported;
                applyBankSync(imported);
                const gotData = imported.loans.length > 0 || imported.expenses.length > 0 || imported.assets.length > 0 || imported.incomeExpenseHistory.some(m => m.income > 0 || m.expenses > 0);
                if (gotData || itemId) break;
                setHint('Fetching your data from the bank. This can take up to a minute on a new connection…');
            }
            if (last) onImported?.(last);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            finish();
        }
    }, [applyBankSync, onImported, finish, itemId]);

    const onExit = useCallback((message: string | null) => {
        if (message) setError(message);
        finish();
    }, [finish]);

    const { launch, ready } = usePlaidLauncher({ token: linkToken, oauthResume, onSuccess, onExit });

    // Web: resume Link automatically when returning from a bank's OAuth login.
    useEffect(() => {
        if (!isSignedIn || !isOAuthReturn()) return;
        const stored = storage.getItem(OAUTH_TOKEN_KEY);
        if (!stored) return;
        setOauthResume(true);
        setLinkToken(stored);
        setStatus('linking');
    }, [isSignedIn]);

    useEffect(() => { if (linkToken && ready && status === 'linking') launch(); }, [linkToken, ready, status, launch]);

    const start = async () => {
        setSheetOpen(false);
        setError(null);
        setStatus('preparing');
        try {
            const { data, errors } = await client.mutations.createPlaidLinkToken({ redirectUri: oauthRedirectUri(), itemId });
            if (errors?.length || !data?.linkToken) throw new Error(errors?.[0]?.message ?? 'Could not start bank connection');
            storage.setItem(OAUTH_TOKEN_KEY, data.linkToken);
            setLinkToken(data.linkToken);
            setStatus('linking');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start bank connection');
            setStatus('idle');
        }
    };

    const busy = status !== 'idle';
    const busyLabel = status === 'preparing' ? 'Preparing…' : status === 'linking' ? 'Opening bank link…' : 'Importing…';

    return (
        <Stack gap="sm">
            <Button variant={variant} size={size} disabled={busy} onPress={() => setSheetOpen(true)}>{busy ? busyLabel : children}</Button>
            {status === 'importing' && hint ? <Text variant="small" color="textMuted">{hint}</Text> : null}
            {error ? <Text variant="small" color="risk" accessibilityRole="alert">{error}</Text> : null}

            <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={isSignedIn ? 'Before you connect' : 'Create an account first'}>
                {isSignedIn ? (
                    <>
                        <Stack gap="md">
                            <Point icon="lock" title="Read-only.">Modulos can never move money, and never sees your bank login. Plaid handles that.</Point>
                            <Point icon="check" title="What we read:">account balances, loan and card details, and transactions, to find your income, bills, debts and debt payments.</Point>
                            <Point icon="check" title="You stay in control.">Every imported value is editable. Disconnect and delete imported data anytime in Profile.</Point>
                        </Stack>
                        <Button size="lg" onPress={start}>Continue to Plaid</Button>
                    </>
                ) : (
                    <>
                        <Text color="textMuted">A bank connection is stored securely on our servers, so it needs an account. Your data stays on this device until you sign up, and you can still enter everything by hand.</Text>
                        <Button size="lg" onPress={() => { setSheetOpen(false); openAuth('signup'); }}>Create an account</Button>
                        <Button variant="ghost" onPress={() => setSheetOpen(false)}>Not now</Button>
                    </>
                )}
            </Sheet>
        </Stack>
    );
};

export default PlaidLinkButton;
