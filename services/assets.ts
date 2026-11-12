import { Asset, AssetType, Finances } from '../types';
import { isActiveLoan } from './payoff';

export interface AssetGroup { type: AssetType; total: number; share: number; count: number }

/** Assets summed by type, largest first, with each type's share of the total. */
export const groupAssets = (assets: Asset[]): AssetGroup[] => {
    const total = assets.reduce((a, x) => a + Math.max(0, x.value), 0);
    const byType = new Map<AssetType, { total: number; count: number }>();
    for (const a of assets) {
        const cur = byType.get(a.type) ?? { total: 0, count: 0 };
        byType.set(a.type, { total: cur.total + Math.max(0, a.value), count: cur.count + 1 });
    }
    return [...byType.entries()]
        .map(([type, v]) => ({ type, total: v.total, count: v.count, share: total > 0 ? v.total / total : 0 }))
        .filter(g => g.total > 0)
        .sort((a, b) => b.total - a.total);
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Month-end snapshot used for the net worth timeline and retirement performance.
 * It is recorded only once a bank is linked: before that, values are typed in and say
 * nothing real about change over time. `retirement` counts bank-linked retirement
 * accounts only; `net` is all assets minus active debt. Returns the same object when
 * nothing changed so callers can skip saving.
 */
export const recordAssetSnapshot = (f: Finances, now: Date = new Date()): Finances => {
    const assets = f.assets ?? [];
    const linked = assets.filter(a => a.plaidItemId);
    const hasBank = linked.length > 0 || f.loans.some(l => l.plaidItemId);
    if (!hasBank) return f;
    const month = monthKey(now);
    const total = Math.round(linked.reduce((a, x) => a + x.value, 0));
    const retirement = Math.round(linked.filter(a => a.type === AssetType.Retirement).reduce((a, x) => a + x.value, 0));
    const net = Math.round(assets.reduce((a, x) => a + x.value, 0) - f.loans.filter(isActiveLoan).reduce((a, l) => a + l.balance, 0));
    const history = f.assetHistory ?? [];
    const existing = history.find(h => h.month === month);
    if (existing && existing.total === total && existing.retirement === retirement && existing.net === net) return f;
    return { ...f, assetHistory: [...history.filter(h => h.month !== month), { month, total, retirement, net }].sort((a, b) => a.month.localeCompare(b.month)).slice(-36) };
};

export interface Performance { first: number; last: number; change: number; percent: number; months: number }

/** Growth of the bank-linked retirement balance over the months we have recorded. */
export const retirementPerformance = (f: Finances): Performance | null => {
    const h = (f.assetHistory ?? []).filter(x => x.retirement > 0);
    if (h.length < 2) return null;
    const first = h[0].retirement;
    const last = h[h.length - 1].retirement;
    return { first, last, change: last - first, percent: first > 0 ? (last - first) / first : 0, months: h.length - 1 };
};

/** Net worth by month from the recorded snapshots (only months that have one). */
export const netWorthTimeline = (f: Finances): { month: string; net: number }[] =>
    (f.assetHistory ?? []).filter((h): h is typeof h & { net: number } => typeof h.net === 'number').map(h => ({ month: h.month, net: h.net }));
