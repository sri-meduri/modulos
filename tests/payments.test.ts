import { describe, expect, it } from 'vitest';
import { logManualPayment, mergeDetectedPayments, milestonesFor, missedPayments, summarizeProgress } from '../services/payments';
import { Finances, LoanType, Payment } from '../types';

const finances = (over: Partial<Finances> = {}): Finances => ({
    incomeType: 'net', monthlyGrossIncome: 0, monthlyNetIncome: 5000, filingStatus: 'single', zip: '', monthly401kContribution: 0,
    annualIraContribution: 0, annualItemizedDeductions: 0, expenses: [],
    loans: [{ id: 'a', name: 'Card', type: LoanType.CreditCard, balance: 1000, apr: 24, term: 5, originalAmount: 2000, minPaymentOverride: 50 }],
    ...over,
});

describe('logManualPayment', () => {
    it('applies only the principal part to the balance and records the payment', () => {
        const out = logManualPayment(finances(), { loanId: 'a', amount: 100 });
        expect(out.interestPortion).toBe(20);
        expect(out.finances.loans[0].balance).toBe(920);
        expect(out.finances.payments).toHaveLength(1);
        expect(out.finances.payments![0].extra).toBe(50);
    });
    it('marks a loan paid off when the balance reaches zero', () => {
        const out = logManualPayment(finances(), { loanId: 'a', amount: 5000 });
        expect(out.paidOff).toBe(true);
        expect(out.finances.loans[0].status).toBe('paid_off');
    });
});

describe('mergeDetectedPayments', () => {
    const detected = (id: string, loanId = 'a'): Payment => ({ id, loanId, amount: 80, date: '2026-11-03', source: 'detected' });
    it('adds new payments unconfirmed, never changes balances, and de-duplicates', () => {
        const once = mergeDetectedPayments(finances(), [detected('t1')]);
        expect(once.payments).toHaveLength(1);
        expect(once.payments![0].confirmed).toBe(false);
        expect(once.payments![0].extra).toBe(30);
        expect(once.loans[0].balance).toBe(1000);
        const twice = mergeDetectedPayments(once, [detected('t1')]);
        expect(twice.payments).toHaveLength(1);
    });
    it('ignores payments for debts that no longer exist', () => {
        expect(mergeDetectedPayments(finances(), [detected('t2', 'gone')]).payments).toBeUndefined();
    });
});

describe('missedPayments', () => {
    it('flags a debt past its due date with no payment this month', () => {
        const f = finances({ loans: [{ ...finances().loans[0], dueDay: 5 }] });
        expect(missedPayments(f, new Date(2026, 10, 20))).toHaveLength(1);
        expect(missedPayments(f, new Date(2026, 10, 6))).toHaveLength(0); // grace period
        const paid = { ...f, payments: [{ id: 'p', loanId: 'a', amount: 50, date: '2026-11-04', source: 'manual' as const }] };
        expect(missedPayments(paid, new Date(Date.UTC(2026, 10, 20)))).toHaveLength(0);
    });
});

describe('progress', () => {
    it('summarizes percent paid and milestones', () => {
        const f = finances();
        const p = summarizeProgress(f);
        expect(p.startingTotal).toBe(2000);
        expect(p.percent).toBeCloseTo(0.5, 5);
        const done = milestonesFor(f, p).filter(m => m.done).map(m => m.id);
        expect(done).toEqual(expect.arrayContaining(['p10', 'p25', 'p50']));
    });
});
