import { useCallback, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { PlaidLauncherOptions } from './plaidLink.types';

export type { PlaidLauncherOptions, PlaidInstitution } from './plaidLink.types';

/** Web: Plaid Link in the browser, including the OAuth-bank redirect round-trip. */
export const isOAuthReturn = (): boolean => window.location.search.includes('oauth_state_id=');

/**
 * Return URL for banks that use OAuth. It stays /finances because that exact
 * path is registered with Plaid; the route now opens Linked accounts.
 */
export const oauthRedirectUri = (): string | undefined => `${window.location.origin}/finances`;

export const clearOAuthParams = (): void => {
    if (isOAuthReturn()) window.history.replaceState({}, '', window.location.pathname);
};

export const usePlaidLauncher = ({ token, oauthResume, onSuccess, onExit }: PlaidLauncherOptions) => {
    const { open, ready } = usePlaidLink({
        token,
        receivedRedirectUri: oauthResume ? window.location.href : undefined,
        onSuccess: (publicToken, metadata) => {
            if (publicToken) onSuccess(publicToken, { id: metadata.institution?.institution_id ?? undefined, name: metadata.institution?.name ?? undefined });
        },
        onExit: exitError =>
            onExit(exitError ? exitError.display_message || exitError.error_message || `Connection closed (${exitError.error_code ?? 'unknown reason'})` : null),
    });
    const launched = useRef<string | null>(null);
    const launch = useCallback(() => {
        if (!token || launched.current === token) return;
        launched.current = token;
        open();
    }, [token, open]);
    return { launch, ready: ready && !!token };
};
