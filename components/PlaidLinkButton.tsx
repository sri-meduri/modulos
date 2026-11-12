import React, { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { client } from '../lib/amplify';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { parseSyncResult, PlaidImport } from '../services/plaidSync';
import { Button, Sheet, Icon, ICONS } from './ui';

type Status = 'idle' | 'preparing' | 'linking' | 'importing';

const OAUTH_TOKEN_KEY = 'plaid_oauth_link_token';

/** True when the page load is a return-redirect from a bank's OAuth login. */
const isOAuthRedirect = (): boolean => window.location.search.includes('oauth_state_id=');

/**
 * The OAuth return URL for this environment. It stays /finances (even though
 * that tab no longer exists) because this exact path is registered with Plaid;
 * the route now renders Linked accounts, which resumes Link.
 */
const oauthRedirectUri = (): string => `${window.location.origin}/finances`;

interface PlaidLinkButtonProps {
    onImported?: (imported: PlaidImport) => void;
    className?: string;
    /** Button face. */
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'md' | 'lg';
    /** Reconnect an existing item (Plaid update mode). */
    itemId?: string;
}

/**
 * Connect-a-bank flow: trust screen -> createPlaidLinkToken -> Plaid Link ->
 * exchangePlaidPublicToken -> syncPlaidData -> merge into finances.
 *
 * The trust screen states what is read and why before anything opens. Guests
 * cannot link (the connection is stored server-side), so they get an
 * "Create an account to connect a bank" prompt instead.
 */
const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({ onImported, className = '', children, variant = 'primary', size = 'lg', itemId }) => {
    const { user, isGuest, openAuth } = useAuth();
    const { applyBankSync } = useFinance();
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [importHint, setImportHint] = useState<string | null>(null);
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [oauthResume, setOauthResume] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    const isSignedIn = !!user && !isGuest;

    const finishFlow = useCallback(() => {
        setStatus('idle');
        setImportHint(null);
        setLinkToken(null);
        setOauthResume(false);
        sessionStorage.removeItem(OAUTH_TOKEN_KEY);
        if (isOAuthRedirect()) window.history.replaceState({}, '', window.location.pathname);
    }, []);

    const onSuccess = useCallback(
        async (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => {
            setStatus('importing');
            setError(null);
            try {
                let syncItemId = itemId;
                if (!itemId) {
                    const { data: exchange, errors: exchangeErrors } = await client.mutations.exchangePlaidPublicToken({
                        publicToken,
                        institutionId: metadata.institution?.institution_id,
                        institutionName: metadata.institution?.name,
                    });
                    if (exchangeErrors?.length || !exchange) throw new Error(exchangeErrors?.[0]?.message ?? 'Bank connection failed');
                    syncItemId = exchange.itemId;
                }
                // Plaid extracts data asynchronously after a new connection:
                // poll until something lands (up to ~45s).
                const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
                let last: PlaidImport | null = null;
                for (let attempt = 0; attempt < 12; attempt++) {
                    if (attempt > 0) await sleep(4000);
                    const { data: sync, errors: syncErrors } = await client.mutations.syncPlaidData({ itemId: syncItemId });
                    if (syncErrors?.length) throw new Error(syncErrors[0].message);
                    const imported = parseSyncResult(sync);
                    last = imported;
                    applyBankSync(imported);
                    const gotData =
                        imported.loans.length > 0 || imported.expenses.length > 0 || imported.assets.length > 0 ||
                        imported.incomeExpenseHistory.some(m => m.income > 0 || m.expenses > 0);
                    if (gotData || itemId) break;
                    setImportHint('Fetching your data from the bank. This can take up to a minute on a new connection…');
                }
                if (last) onImported?.(last);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Import failed');
            } finally {
                finishFlow();
            }
        },
        [applyBankSync, onImported, finishFlow, itemId]
    );

    const { open, ready } = usePlaidLink({
        token: linkToken,
        receivedRedirectUri: oauthResume ? window.location.href : undefined,
        onSuccess,
        onExit: (exitError) => {
            if (exitError) {
                setError(exitError.display_message || exitError.error_message || `Connection closed (${exitError.error_code ?? 'unknown reason'})`);
            }
            finishFlow();
        },
    });

    // Resume Link automatically when returning from a bank OAuth redirect.
    useEffect(() => {
        if (!isSignedIn || !isOAuthRedirect()) return;
        const storedToken = sessionStorage.getItem(OAUTH_TOKEN_KEY);
        if (!storedToken) return;
        setOauthResume(true);
        setLinkToken(storedToken);
        setStatus('linking');
    }, [isSignedIn]);

    useEffect(() => {
        if (linkToken && ready && status === 'linking') open();
    }, [linkToken, ready, status, open]);

    const startLink = async () => {
        setSheetOpen(false);
        setError(null);
        setStatus('preparing');
        try {
            const { data, errors } = await client.mutations.createPlaidLinkToken({ redirectUri: oauthRedirectUri(), itemId });
            if (errors?.length || !data?.linkToken) throw new Error(errors?.[0]?.message ?? 'Could not start bank connection');
            sessionStorage.setItem(OAUTH_TOKEN_KEY, data.linkToken);
            setLinkToken(data.linkToken);
            setStatus('linking');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start bank connection');
            setStatus('idle');
        }
    };

    const busy = status !== 'idle';
    const busyLabel = status === 'preparing' ? 'Preparing…' : status === 'linking' ? 'Opening bank link…' : 'Importing…';
    const face = children ?? 'Connect with Plaid';

    return (
        <div className={className}>
            <Button variant={variant} size={size} className="w-full" disabled={busy} onClick={() => setSheetOpen(true)}>
                {busy ? busyLabel : face}
            </Button>
            {status === 'importing' && importHint && <p className="mt-2 text-sm text-dark-text-secondary">{importHint}</p>}
            {error && <p className="mt-2 text-sm text-risk" role="alert">{error}</p>}

            <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={isSignedIn ? 'Before you connect' : 'Create an account first'}>
                {isSignedIn ? (
                    <>
                        <ul className="flex flex-col gap-3 text-[15px] text-[#D5DAE3]">
                            <li className="flex gap-3"><Icon d={ICONS.lock} className="w-5 h-5 shrink-0 text-accent mt-0.5" /><span><strong>Read-only.</strong> Modulos can never move money, and never sees your bank login. Plaid handles that.</span></li>
                            <li className="flex gap-3"><Icon d={ICONS.check} className="w-5 h-5 shrink-0 text-accent mt-0.5" /><span><strong>What we read:</strong> account balances, loan and card details, and transactions, to find your income, bills, debts and debt payments.</span></li>
                            <li className="flex gap-3"><Icon d={ICONS.check} className="w-5 h-5 shrink-0 text-accent mt-0.5" /><span><strong>You stay in control.</strong> Every imported value is editable. Disconnect and delete imported data anytime in Profile.</span></li>
                        </ul>
                        <Button size="lg" onClick={startLink}>Continue to Plaid</Button>
                    </>
                ) : (
                    <>
                        <p className="text-[15px] text-[#D5DAE3]">A bank connection is stored securely on our servers, so it needs an account. Your data stays on this device until you sign up, and you can still enter everything by hand.</p>
                        <Button size="lg" onClick={() => { setSheetOpen(false); openAuth('signup'); }}>Create an account</Button>
                        <Button variant="ghost" onClick={() => setSheetOpen(false)}>Not now</Button>
                    </>
                )}
            </Sheet>
        </div>
    );
};

export default PlaidLinkButton;
