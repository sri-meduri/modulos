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

/** One day's snapshot. */
export interface Snapshot { date: string; total: number; retirement: number; net?: number }

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Newest first would be wrong for charts: oldest first, with older monthly entries (`month`) read as mid-month. */
export const snapshots = (f: Pick<Finances, 'assetHistory'>): Snapshot[] =>
    (f.assetHistory ?? [])
        .map(h => ({ date: h.date ?? (h.month ? `${h.month}-15` : ''), total: h.total, retirement: h.retirement, net: h.net }))
        .filter(h => h.date)
        .sort((a, b) => a.date.localeCompare(b.date));

/** Daily history kept (about 13 months). */
const MAX_SNAPSHOTS = 400;

/**
 * Daily snapshot used for the net worth timeline and retirement performance, like a
 * personal-finance app that refreshes every 24 hours. Recorded only once a bank is linked:
 * before that, values are typed in and say nothing real about change over time.
 * `retirement` counts bank-linked retirement accounts; `net` is all assets minus active debt.
 * A new day always adds a point (even if nothing moved) so the line is continuous;
 * within a day the point is updated only when a value changed. Returns the same object
 * when nothing changed so callers can skip saving.
 */
export const recordAssetSnapshot = (f: Finances, now: Date = new Date()): Finances => {
    const assets = f.assets ?? [];
    const linked = assets.filter(a => a.plaidItemId);
    const hasBank = linked.length > 0 || f.loans.some(l => l.plaidItemId);
    if (!hasBank) return f;
    const date = dateKey(now);
    const total = Math.round(linked.reduce((a, x) => a + x.value, 0));
    const retirement = Math.round(linked.filter(a => a.type === AssetType.Retirement).reduce((a, x) => a + x.value, 0));
    const net = Math.round(assets.reduce((a, x) => a + x.value, 0) - f.loans.filter(isActiveLoan).reduce((a, l) => a + l.balance, 0));
    const history = snapshots(f);
    const today = history.find(h => h.date === date);
    if (today && today.total === total && today.retirement === retirement && today.net === net && !(f.assetHistory ?? []).some(h => h.month)) return f;
    const next = [...history.filter(h => h.date !== date), { date, total, retirement, net }].slice(-MAX_SNAPSHOTS);
    return { ...f, assetHistory: next };
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);

/** "12 days", "3 months": how far back a range of snapshots reaches, in whole words. */
export const elapsedLabel = (days: number): string => {
    if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'}`;
    const months = Math.round(days / 30.4);
    return `${months} ${months === 1 ? 'month' : 'months'}`;
};

export interface Performance { first: number; last: number; change: number; percent: number; days: number }

/** Growth of the bank-linked retirement balance over the days we have recorded. */
export const retirementPerformance = (f: Finances): Performance | null => {
    const h = snapshots(f).filter(x => x.retirement > 0);
    if (h.length < 2) return null;
    const first = h[0].retirement;
    const last = h[h.length - 1].retirement;
    return { first, last, change: last - first, percent: first > 0 ? (last - first) / first : 0, days: daysBetween(h[0].date, h[h.length - 1].date) };
};

/** Net worth by day from the recorded snapshots. */
export const netWorthTimeline = (f: Finances): { date: string; net: number }[] =>
    snapshots(f).filter((h): h is Snapshot & { net: number } => typeof h.net === 'number').map(h => ({ date: h.date, net: h.net }));

/**
 * Axis label for a snapshot: "November 12"-style short dates while the history is under
 * about four months long, month and year after that.
 */
export const snapshotLabel = (date: string, spanDays: number): string => {
    const d = new Date(`${date}T12:00:00`);
    return spanDays <= 120
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const spanOf = (dates: string[]): number => (dates.length < 2 ? 0 : daysBetween(dates[0], dates[dates.length - 1]));
