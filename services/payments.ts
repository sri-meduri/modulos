import { Finances, Loan, Payment, PaymentCandidate } from '../types';
import { getEffectiveMinPayment } from './loanCalculator';
import { isActiveLoan } from './payoff';

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Logs a payment by hand and updates the balance. Only the principal part of
 * the payment reduces the balance (a month's interest is paid first). A debt
 * that reaches zero is marked paid off.
 */
export function logManualPayment(
    finances: Finances,
    input: { loanId: string; amount: number; date?: string }
): { finances: Finances; interestPortion: number; paidOff: boolean } {
    const loan = finances.loans.find(l => l.id === input.loanId);
    if (!loan || input.amount <= 0) return { finances, interestPortion: 0, paidOff: false };

    const interest = Math.min(input.amount, (loan.balance * loan.apr) / 1200);
    const principal = Math.max(0, input.amount - interest);
    const newBalance = Math.max(0, round2(loan.balance - principal));
    const paidOff = newBalance <= 0.5;
    const min = getEffectiveMinPayment(loan);

    const payment: Payment = {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        loanId: loan.id,
        amount: round2(input.amount),
        date: input.date ?? todayISO(),
        source: 'manual',
        extra: round2(Math.max(0, input.amount - min)),
        confirmed: true,
    };

    return {
        interestPortion: round2(interest),
        paidOff,
        finances: {
            ...finances,
            loans: finances.loans.map(l =>
                l.id === loan.id
                    ? { ...l, balance: paidOff ? 0 : newBalance, status: paidOff ? 'paid_off' : l.status }
                    : l
            ),
            payments: [payment, ...(finances.payments ?? [])],
        },
    };
}

/**
 * Merges bank-detected payments. Balances are NOT touched: a bank sync already
 * refreshes each linked loan's balance, so adjusting again would double count.
 * New payments are unconfirmed until the user okays the first one per debt.
 */
export function mergeDetectedPayments(finances: Finances, detected: Payment[]): Finances {
    if (detected.length === 0) return finances;
    const existing = finances.payments ?? [];
    const known = new Set(existing.map(p => p.id));
    const loansById = new Map(finances.loans.map(l => [l.id, l]));
    const confirmedLoans = new Set(existing.filter(p => p.confirmed).map(p => p.loanId));

    const fresh: Payment[] = [];
    for (const p of detected) {
        if (known.has(p.id)) continue;
        const loan = loansById.get(p.loanId);
        if (!loan) continue; // matched a debt the user no longer has
        fresh.push({
            ...p,
            source: 'detected',
            extra: round2(Math.max(0, p.amount - getEffectiveMinPayment(loan))),
            confirmed: confirmedLoans.has(p.loanId),
        });
    }
    if (fresh.length === 0) return finances;
    const merged = [...fresh, ...existing].sort((a, b) => b.date.localeCompare(a.date));
    return { ...finances, payments: merged };
}

export const confirmPayment = (finances: Finances, id: string): Finances => ({
    ...finances,
    payments: (finances.payments ?? []).map(p => (p.id === id ? { ...p, confirmed: true } : p)),
});

export const removePayment = (finances: Finances, id: string): Finances => ({
    ...finances,
    payments: (finances.payments ?? []).filter(p => p.id !== id),
});

/** The user said an unmatched transaction IS a payment on `loanId`. */
export function candidateToPayment(c: PaymentCandidate, loan: Loan): Payment {
    return {
        id: c.id,
        loanId: loan.id,
        amount: c.amount,
        date: c.date,
        source: 'detected',
        extra: round2(Math.max(0, c.amount - getEffectiveMinPayment(loan))),
        confirmed: true,
        payee: c.payee,
    };
}

/** Active debts whose due date has passed this month with no payment logged. */
export function missedPayments(finances: Finances, now: Date = new Date()): Loan[] {
    const monthKey = now.toISOString().slice(0, 7);
    const day = now.getDate();
    return finances.loans.filter(loan => {
        if (!isActiveLoan(loan) || !loan.dueDay) return false;
        if (day <= loan.dueDay + 2) return false; // 2-day grace for posting delays
        return !(finances.payments ?? []).some(p => p.loanId === loan.id && p.date.startsWith(monthKey));
    });
}

export interface ProgressSummary {
    startingTotal: number;
    paidOff: number;
    percent: number;
    paidThisMonth: number;
    extraPaidTotal: number;
}

export function summarizeProgress(finances: Finances): ProgressSummary {
    const counted = finances.loans.filter(l => (l.status ?? 'active') !== 'considering');
    const startingTotal = counted.reduce((a, l) => a + Math.max(l.originalAmount, l.balance), 0);
    const paidOff = counted.reduce((a, l) => a + Math.max(0, Math.max(l.originalAmount, l.balance) - l.balance), 0);
    const monthKey = new Date().toISOString().slice(0, 7);
    const payments = finances.payments ?? [];
    return {
        startingTotal,
        paidOff,
        percent: startingTotal > 0 ? paidOff / startingTotal : 0,
        paidThisMonth: payments.filter(p => p.date.startsWith(monthKey)).reduce((a, p) => a + p.amount, 0),
        extraPaidTotal: payments.reduce((a, p) => a + (p.extra ?? 0), 0),
    };
}

export interface Milestone {
    id: string;
    label: string;
    detail: string;
    done: boolean;
    /** 0-1 progress toward unlocking it (1 when done). */
    progress: number;
    /** Short progress caption, e.g. "42% of 50%". */
    caption: string;
}

/** Milestones with progress toward each, in the order they are usually reached. */
export function milestonesFor(finances: Finances, progress: ProgressSummary): Milestone[] {
    const payments = finances.payments ?? [];
    const extraPaid = payments.some(p => (p.extra ?? 0) > 0);
    const paidLoans = finances.loans.filter(l => l.status === 'paid_off').length;
    const open = finances.loans.filter(l => (l.status ?? 'active') === 'active' && l.balance > 0.005);
    // Closest debt to being paid off, by share already repaid.
    const nearest = open.reduce((best, l) => Math.max(best, 1 - l.balance / Math.max(l.originalAmount, l.balance, 1)), 0);
    // Compare on whole percents so what the screen shows ("10%") always agrees with "done".
    const shown = Math.round(progress.percent * 100);
    const pctMilestone = (id: string, label: string, target: number): Milestone => ({
        id, label, detail: `${Math.round(target * 100)}% of your starting debt repaid`,
        done: shown >= Math.round(target * 100), progress: Math.min(1, shown / Math.round(target * 100)),
        caption: `${shown}% of ${Math.round(target * 100)}%`,
    });
    const flag = (id: string, label: string, detail: string, done: boolean, progressNow = 0): Milestone => ({
        id, label, detail, done, progress: done ? 1 : progressNow, caption: done ? 'Done' : 'Not yet',
    });
    return [
        flag('first-payment', 'First payment logged', 'Log or auto-detect your first payment', payments.length > 0),
        flag('first-extra', 'First extra payment', 'Pay more than the minimum once', extraPaid),
        pctMilestone('p10', '10% paid off', 0.1),
        pctMilestone('p25', 'A quarter paid off', 0.25),
        { ...flag('first-debt', 'First debt paid off', 'Clear one debt completely', paidLoans > 0, nearest), caption: paidLoans > 0 ? 'Done' : `${Math.round(nearest * 100)}% of your closest debt` },
        pctMilestone('p50', 'Halfway there', 0.5),
        pctMilestone('p75', 'Three quarters done', 0.75),
        { ...pctMilestone('p100', 'Debt-free', 1), done: progress.startingTotal > 0 && progress.percent >= 0.999 },
    ];
}

export interface MonthPlan {
    /** 'YYYY-MM' */
    month: string;
    label: string;
    planned: number;
    actual: number;
}

/**
 * Plan vs actual: what the plan calls for each month (all minimums plus the extra)
 * against what was really paid, for the last `months` months including this one.
 */
export function planVsActual(finances: Finances, plannedMonthly: number, months = 6, now: Date = new Date()): MonthPlan[] {
    const out: MonthPlan[] = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        out.push({
            month: key,
            label: d.toLocaleDateString('en-US', { month: 'short' }),
            planned: plannedMonthly,
            actual: (finances.payments ?? []).filter(p => p.date.startsWith(key)).reduce((a, p) => a + p.amount, 0),
        });
    }
    return out;
}
