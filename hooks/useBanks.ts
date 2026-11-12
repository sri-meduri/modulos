import { useCallback, useEffect, useState } from 'react';
import { client } from '../lib/amplify';
import { useAuth } from '../contexts/AuthContext';

export interface BankRow {
    id: string;
    itemId: string;
    institutionName: string | null;
    connectedAt: string | null;
    lastSyncedAt: string | null;
    status: string | null;
    needsAttention: boolean;
}

/** Bank connections for the signed-in user (empty for guests; no network calls). */
export const useBanks = () => {
    const { user, isGuest } = useAuth();
    const signedIn = !!user && !isGuest;
    const [banks, setBanks] = useState<BankRow[]>([]);
    const [loaded, setLoaded] = useState(!signedIn);

    const reload = useCallback(async () => {
        if (!signedIn) { setBanks([]); setLoaded(true); return; }
        try {
            const { data } = await client.models.PlaidItem.list();
            setBanks(data.map(i => ({
                id: i.id, itemId: i.itemId, institutionName: i.institutionName ?? null,
                connectedAt: i.connectedAt ?? null, lastSyncedAt: i.lastSyncedAt ?? null,
                status: i.status ?? null, needsAttention: i.status === 'needs_attention',
            })));
        } catch { /* best effort: treat as none */ }
        setLoaded(true);
    }, [signedIn]);

    useEffect(() => { reload(); }, [reload]);
    return { banks, loaded, reload, signedIn };
};

export const timeAgo = (iso: string | null): string => {
    if (!iso) return 'never synced';
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} minutes ago`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? '' : 's'} ago`;
};
