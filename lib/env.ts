/**
 * Which backend this build talks to. Set VITE_APP_ENV=sandbox in .env.local
 * (see docs/SANDBOX.md) and the app shows a visible SANDBOX badge so a test
 * build can never be mistaken for the live app.
 */
export const appEnv = (): string => {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return (env?.VITE_APP_ENV ?? '').toLowerCase();
};

export const isSandbox = (): boolean => appEnv() === 'sandbox';

/** Human label for non-production environments; empty in production. */
export const appEnvLabel = (): string => {
    const e = appEnv();
    return e && e !== 'production' ? e.toUpperCase() : '';
};
