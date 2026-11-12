import { useEffect, useRef } from 'react';
import { client } from '../lib/amplify';
import { useFinance } from '../contexts/FinanceContext';
import { parseSyncResult } from '../services/plaidSync';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Keeps linked banks fresh: whenever the app is open, any bank that has not synced in the
 * last 24 hours is refreshed in the background (checked on start and then hourly). This is
 * what makes the net worth timeline and balances update daily without the user pressing
 * Refresh. It runs only for signed-in users with a linked bank.
 */
export const useDailyBankSync = (enabled: boolean): void => {
    const { applyBankSync } = useFinance();
    const apply = useRef(applyBankSync);
    apply.current = applyBankSync;

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        const run = async () => {
            try {
                const { data: items } = await client.models.PlaidItem.list();
                for (const item of items) {
                    if (item.status === 'needs_attention') continue;
                    const last = item.lastSyncedAt ? Date.parse(item.lastSyncedAt) : 0;
                    if (Date.now() - last < DAY_MS) continue;
                    const { data, errors } = await client.mutations.syncPlaidData({ itemId: item.itemId });
                    if (!errors?.length && !cancelled) apply.current(parseSyncResult(data));
                }
            } catch {
                // Best effort: the next hourly check tries again.
            }
        };
        run();
        const timer = setInterval(run, CHECK_EVERY_MS);
        return () => { cancelled = true; clearInterval(timer); };
    }, [enabled]);
};
