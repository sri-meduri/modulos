import { useCallback, useEffect, useState } from 'react';
import { client } from '../lib/amplify';
import { useAuth } from '../contexts/AuthContext';

export interface BankTransaction {
    id: string;
    /** YYYY-MM-DD */
    date: string;
    name: string;
    /** Plaid convention: positive = money out, negative = money in. */
    amount: number;
    category: string;
    account: string;
}

const parse = (value: unknown): BankTransaction[] => {
    let v = value;
    for (let depth = 0; depth < 3 && typeof v === 'string'; depth++) {
        try { v = JSON.parse(v); } catch { return []; }
    }
    return Array.isArray(v) ? (v as BankTransaction[]) : [];
};

/**
 * Recent transactions from linked banks (last `days`, default 60). Only fetched when
 * `enabled` (a bank is linked and the user is signed in); guests and manual users never
 * call the backend.
 */
export const useTransactions = (enabled: boolean, days = 60) => {
    const { user, isGuest } = useAuth();
    const active = enabled && !!user && !isGuest;
    const [transactions, setTransactions] = useState<BankTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        if (!active) return;
        setLoading(true);
        setError(null);
        try {
            const { data, errors } = await client.mutations.listPlaidTransactions({ days });
            if (errors?.length) throw new Error(errors[0].message);
            setTransactions(parse(data?.transactions));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load transactions');
        } finally {
            setLoading(false);
        }
    }, [active, days]);

    useEffect(() => { reload(); }, [reload]);
    return { transactions, loading, error, reload, active };
};
