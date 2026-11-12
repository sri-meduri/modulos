import { useCallback, useRef } from 'react';
import { createPlaidLinkSession } from 'react-native-plaid-link-sdk';
import { PlaidLauncherOptions } from './plaidLink.types';

export type { PlaidLauncherOptions, PlaidInstitution } from './plaidLink.types';

/** Native: the Plaid SDK handles OAuth banks itself; there is no page redirect to resume. */
export const isOAuthReturn = (): boolean => false;
export const oauthRedirectUri = (): string | undefined => undefined;
export const clearOAuthParams = (): void => undefined;

export const usePlaidLauncher = ({ token, onSuccess, onExit }: PlaidLauncherOptions) => {
    const launched = useRef<string | null>(null);
    const launch = useCallback(() => {
        if (!token || launched.current === token) return;
        launched.current = token;
        createPlaidLinkSession({
            token,
            onSuccess: ({ publicToken, metadata }) => onSuccess(publicToken, { id: metadata.institution?.id, name: metadata.institution?.name }),
            onExit: ({ error }) => onExit(error ? error.displayMessage || error.errorMessage || `Connection closed (${error.errorCode})` : null),
            onEvent: () => undefined,
        })
            .then(session => session.open())
            .catch(e => onExit(e instanceof Error ? e.message : 'Could not open bank link'));
    }, [token, onSuccess, onExit]);
    return { launch, ready: !!token };
};
