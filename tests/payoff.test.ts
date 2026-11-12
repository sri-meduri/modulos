import { describe, expect, it } from 'vitest';
import { extraForTarget, orderLoans, simulatePayoff } from '../services/payoff';
import { calculateMinimumPayment } from '../services/loanCalculator';
import { Loan, LoanType } from '../types';

const loan = (o: Partial<Loan> & { id: string }): Loan => ({
    name: o.id, type: LoanType.Other, balance: 1000, apr: 10, term: 2, originalAmount: 1000, ...o,
});
const card = loan({ id: 'card', type: LoanType.CreditCard, balance: 3000, apr: 22, originalAmount: 3000, minPaymentOverride: 90 });
const auto = loan({ id: 'auto', type: LoanType.Auto, balance: 11000, apr: 7, term: 5, originalAmount: 15000 });

describe('calculateMinimumPayment', () => {
    it('matches the standard amortization formula', () => {
        expect(calculateMinimumPayment(10000, 5, 5)).toBeCloseTo(188.71, 2);
        expect(calculateMinimumPayment(1200, 0, 1)).toBeCloseTo(100, 5);
        expect(calculateMinimumPayment(0, 5, 5)).toBe(0);
    });
});

describe('simulatePayoff', () => {
    it('pays everything off and an extra payment shortens the plan and saves interest', () => {
        const base = simulatePayoff([card, auto], 0);
        const more = simulatePayoff([card, auto], 250);
        expect(base.neverPaysOff).toBe(false);
        expect(more.months).toBeLessThan(base.months);
        expect(more.totalInterest).toBeLessThan(base.totalInterest);
        expect(more.balanceSeries.at(-1)).toBe(0);
        expect(more.balanceSeries[0]).toBe(14000);
    });
    it('ignores considering and paid-off loans', () => {
        const r = simulatePayoff([card, { ...auto, status: 'considering' }, { ...auto, id: 'x', status: 'paid_off' }], 0);
        expect(r.order).toEqual(['card']);
    });
    it('reports a plan that never pays off', () => {
        const bad = loan({ id: 'bad', balance: 10000, apr: 30, minPaymentOverride: 10 });
        expect(simulatePayoff([bad], 0).neverPaysOff).toBe(true);
    });
    it('orders by strategy', () => {
        expect(orderLoans([auto, card], 'avalanche').map(l => l.id)).toEqual(['card', 'auto']);
        expect(orderLoans([card, auto], 'snowball').map(l => l.id)).toEqual(['card', 'auto']);
        expect(orderLoans([card, auto], 'custom', ['auto', 'card']).map(l => l.id)).toEqual(['auto', 'card']);
    });
});

describe('extraForTarget', () => {
    it('finds an extra amount that meets the target', () => {
        const extra = extraForTarget([card, auto], 24, 'avalanche');
        expect(extra).not.toBeNull();
        expect(simulatePayoff([card, auto], extra!).months).toBeLessThanOrEqual(24);
    });
    it('returns null when unreachable', () => {
        expect(extraForTarget([card, auto], 1, 'avalanche', [], 100)).toBeNull();
    });
});
