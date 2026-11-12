/**
 * Which backend this build talks to. `npm run dev:sandbox` sets
 * EXPO_PUBLIC_APP_ENV=sandbox so the app shows a visible SANDBOX badge and a
 * test build can never be mistaken for the live app.
 */
const appEnv = (): string => (process.env.EXPO_PUBLIC_APP_ENV ?? '').toLowerCase();

/** Label for non-production environments; empty in production. */
export const appEnvLabel = (): string => {
    const e = appEnv();
    return e && e !== 'production' ? e.toUpperCase() : '';
};
