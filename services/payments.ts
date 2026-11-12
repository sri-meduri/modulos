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
    done: boolean;
}

export function milestonesFor(finances: Finances, progress: ProgressSummary): Milestone[] {
    const payments = finances.payments ?? [];
    return [
        { id: 'first-payment', label: 'First payment logged', done: payments.length > 0 },
        { id: 'first-extra', label: 'First extra payment', done: payments.some(p => (p.extra ?? 0) > 0) },
        { id: 'p10', label: '10% paid off', done: progress.percent >= 0.1 },
        { id: 'p25', label: 'A quarter paid off', done: progress.percent >= 0.25 },
        { id: 'first-debt', label: 'First debt paid off', done: finances.loans.some(l => l.status === 'paid_off') },
        { id: 'p50', label: 'Halfway there', done: progress.percent >= 0.5 },
        { id: 'p100', label: 'Debt-free', done: progress.startingTotal > 0 && progress.percent >= 0.999 },
    ];
}
