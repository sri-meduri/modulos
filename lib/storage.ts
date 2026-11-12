import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Key-value storage that works the same on web (localStorage under the hood)
 * and native (AsyncStorage). Everything is loaded into memory once at startup
 * (`hydrateStorage`), so reads are synchronous and writes persist in the
 * background. Existing web keys (guest_finances, user_<id>_finances, ...) keep
 * working because AsyncStorage on web IS localStorage.
 */
const cache = new Map<string, string>();

export const hydrateStorage = async (): Promise<void> => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const pairs = await AsyncStorage.multiGet(keys);
        pairs.forEach(([k, v]) => { if (v !== null) cache.set(k, v); });
    } catch {
        // Storage unavailable (private mode): run from memory only.
    }
};

export const storage = {
    getItem: (key: string): string | null => cache.get(key) ?? null,
    setItem: (key: string, value: string): void => {
        cache.set(key, value);
        AsyncStorage.setItem(key, value).catch(() => undefined);
    },
    removeItem: (key: string): void => {
        cache.delete(key);
        AsyncStorage.removeItem(key).catch(() => undefined);
    },
    /** App-owned JSON helpers. */
    getJson: <T>(key: string): T | null => {
        try {
            const raw = cache.get(key);
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            return null;
        }
    },
    setJson: (key: string, value: unknown): void => storage.setItem(key, JSON.stringify(value)),
    /** Removes every app-owned key (guest/sample/user data). Amplify's auth keys are left to Amplify. */
    clearAppData: (): void => {
        for (const key of [...cache.keys()]) {
            if (/^(guest|sample|user_)/.test(key) || key === 'guestMode' || key === 'sampleMode') storage.removeItem(key);
        }
    },
};

/** Removes stale Cognito/Amplify auth state, including interrupted-OAuth locks. */
export const purgeAuthStorage = async (): Promise<void> => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const stale = keys.filter(k => /^(CognitoIdentityServiceProvider|com\.amplify|amplify)/.test(k));
        if (stale.length) await AsyncStorage.multiRemove(stale);
        if (typeof sessionStorage !== 'undefined') {
            Object.keys(sessionStorage).filter(k => /^(CognitoIdentityServiceProvider|com\.amplify|amplify)/.test(k)).forEach(k => sessionStorage.removeItem(k));
        }
    } catch {
        // Best effort.
    }
};
