import { Loan, PayoffStrategy } from '../types';
import { getEffectiveMinPayment } from './loanCalculator';

/** Loans that count toward totals, payments and the plan. */
export const isActiveLoan = (loan: Loan): boolean =>
    (loan.status ?? 'active') === 'active' && loan.balance > 0.005;

export interface PayoffResult {
    /** Months until every loan is paid; 0 when there is nothing to pay. */
    months: number;
    totalInterest: number;
    /** True when payments never outrun interest (hit the 50-year cap). */
    neverPaysOff: boolean;
    /** Total balance at the start of each month; index 0 = today. */
    balanceSeries: number[];
    /** Per-loan balance, same indexing. */
    loanSeries: Record<string, number[]>;
    /** Month number (1 = next month) each loan reaches zero. */
    payoffMonth: Record<string, number>;
    /** Loan ids in the order the plan attacks them. */
    order: string[];
    totalMinimum: number;
}

const MAX_MONTHS = 600;

export const orderLoans = (loans: Loan[], strategy: PayoffStrategy, customOrder: string[] = []): Loan[] => {
    const byApr = (a: Loan, b: Loan) => b.apr - a.apr || a.balance - b.balance;
    if (strategy === 'snowball') {
        return [...loans].sort((a, b) => a.balance - b.balance || b.apr - a.apr);
    }
    if (strategy === 'custom') {
        const rank = new Map(customOrder.map((id, i) => [id, i]));
        return [...loans].sort((a, b) => {
            const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Infinity;
            const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Infinity;
            return ra === rb ? byApr(a, b) : ra - rb;
        });
    }
    return [...loans].sort(byApr);
};

/**
 * Month-by-month payoff simulation. One monthly pool (all minimums + `extra`)
 * is split: minimums first, then everything left goes to the first unpaid
 * loan in strategy order, so freed-up minimums roll forward automatically.
 */
export const simulatePayoff = (
    allLoans: Loan[],
    extra: number,
    strategy: PayoffStrategy = 'avalanche',
    customOrder: string[] = []
): PayoffResult => {
    const loans = orderLoans(allLoans.filter(isActiveLoan), strategy, customOrder);
    const mins: Record<string, number> = {};
    const bal: Record<string, number> = {};
    for (const l of loans) {
        mins[l.id] = getEffectiveMinPayment(l);
        bal[l.id] = l.balance;
    }
    const totalMinimum = loans.reduce((a, l) => a + mins[l.id], 0);
    const pool = totalMinimum + Math.max(0, extra);

    const sum = () => loans.reduce((a, l) => a + bal[l.id], 0);
    const balanceSeries = [sum()];
    const loanSeries: Record<string, number[]> = {};
    loans.forEach(l => (loanSeries[l.id] = [bal[l.id]]));
    const payoffMonth: Record<string, number> = {};

    let months = 0;
    let totalInterest = 0;
    while (sum() > 0.01 && months < MAX_MONTHS) {
        months++;
        for (const l of loans) {
            if (bal[l.id] > 0) {
                const interest = (bal[l.id] * l.apr) / 1200;
                bal[l.id] += interest;
                totalInterest += interest;
            }
        }
        let left = pool;
        for (const l of loans) {
            if (bal[l.id] > 0 && left > 0) {
                const pay = Math.min(bal[l.id], mins[l.id], left);
                bal[l.id] -= pay;
                left -= pay;
            }
        }
        for (const l of loans) {
            if (bal[l.id] > 0 && left > 0) {
                const pay = Math.min(bal[l.id], left);
                bal[l.id] -= pay;
                left -= pay;
            }
        }
        for (const l of loans) {
            if (bal[l.id] <= 0.01 && payoffMonth[l.id] === undefined) {
                bal[l.id] = 0;
                payoffMonth[l.id] = months;
            }
            loanSeries[l.id].push(bal[l.id]);
        }
        balanceSeries.push(sum());
    }

    return {
        months,
        totalInterest,
        neverPaysOff: sum() > 0.01,
        balanceSeries,
        loanSeries,
        payoffMonth,
        order: loans.map(l => l.id),
        totalMinimum,
    };
};

/** Smallest extra monthly payment (rounded up to $5) that finishes within `targetMonths`. */
export const extraForTarget = (
    loans: Loan[],
    targetMonths: number,
    strategy: PayoffStrategy,
    customOrder: string[] = [],
    cap = 20000
): number | null => {
    if (targetMonths <= 0) return null;
    const fits = (extra: number) => {
        const r = simulatePayoff(loans, extra, strategy, customOrder);
        return !r.neverPaysOff && r.months <= targetMonths;
    };
    if (fits(0)) return 0;
    if (!fits(cap)) return null;
    let lo = 0;
    let hi = cap;
    while (hi - lo > 5) {
        const mid = Math.floor((lo + hi) / 2);
        if (fits(mid)) hi = mid;
        else lo = mid;
    }
    return Math.ceil(hi / 5) * 5;
};

// ---- Dates (one format everywhere: "Mar 2029") -----------------------------

export const addMonths = (months: number, from: Date = new Date()): Date =>
    new Date(from.getFullYear(), from.getMonth() + months, 1);

export const formatMonthYear = (d: Date): string =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

export const payoffLabel = (result: PayoffResult): string =>
    result.months === 0 ? 'Debt-free' : result.neverPaysOff ? 'Not within 50 years' : formatMonthYear(addMonths(result.months));

/** "2 years 3 months" / "7 months" / "1 month" (full words, no abbreviations). */
export const formatDuration = (months: number): string => {
    if (months <= 0) return '0 months';
    const y = Math.floor(months / 12);
    const m = months % 12;
    const parts: string[] = [];
    if (y) parts.push(`${y} year${y === 1 ? '' : 's'}`);
    if (m) parts.push(`${m} month${m === 1 ? '' : 's'}`);
    return parts.join(' ');
};

/** "March 2029" (full month name, used where there is room). */
export const formatMonthYearLong = (d: Date): string => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export const monthKeyToDate = (key: string): Date => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1);
};

export const monthsBetweenNow = (key: string): number => {
    const t = monthKeyToDate(key);
    const n = new Date();
    return (t.getFullYear() - n.getFullYear()) * 12 + (t.getMonth() - n.getMonth());
};
