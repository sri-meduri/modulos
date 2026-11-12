import { describe, expect, it } from 'vitest';
import { allocateIncome, groupBills } from '../services/allocation';
import { nextBestAction, ActionInput } from '../services/nextAction';
import { milestonesFor, planVsActual, summarizeProgress } from '../services/payments';
import { evaluateNewLoan } from '../services/loanTest';
import { computeMonthlyTakeHome, getLocalInfo, getStateName, getStateStdDed, zipToState } from '../services/taxCalculator';
import { Finances, LoanType, RiskProfile, Settings } from '../types';

const loan = { id: 'a', name: 'Visa', type: LoanType.CreditCard, balance: 1000, apr: 24, term: 5, originalAmount: 2000, minPaymentOverride: 50 };
const finances = (over: Partial<Finances> = {}): Finances => ({
    incomeType: 'net', monthlyGrossIncome: 0, monthlyNetIncome: 5000, filingStatus: 'single', zip: '', monthly401kContribution: 0,
    annualIraContribution: 0, annualItemizedDeductions: 0, expenses: [], loans: [loan], ...over,
});
const settings = (over: Partial<Settings> = {}): Settings => ({ riskProfile: RiskProfile.Average, ...over });
const input = (over: Partial<ActionInput> = {}): ActionInput => ({
    finances: finances(), settings: settings(), activeLoans: [loan] as never, leftover: 1000, dti: 0.1,
    unconfirmedPayments: 0, paymentCandidates: 0, hasBank: true, ...over,
});

describe('where your money goes', () => {
    const expenses = [
        { id: 'Rent', name: 'Rent', amount: 1500 },
        { id: 'Groceries', name: 'Groceries', amount: 500 },
        { id: 'custom-1', name: 'Gym', amount: 50 },
        { id: 'zero', name: 'Nothing', amount: 0 },
    ];
    it('groups bills by category and puts unknown ones under Other', () => {
        const g = groupBills(expenses);
        expect(g.map(x => x.label)).toEqual(['Housing / Utilities', 'Food', 'Other']);
    });
    it('splits income into bills, debt minimums, extra and what is left, summing to 100%', () => {
        const r = allocateIncome(5000, expenses, 400, 300);
        const byKind = (k: string) => r.slices.filter(s => s.kind === k).reduce((a, s) => a + s.amount, 0);
        expect(byKind('bills')).toBe(2050);
        expect(byKind('debt')).toBe(400);
        expect(byKind('extra')).toBe(300);
        expect(byKind('left')).toBe(2250);
        expect(r.slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 6);
        expect(r.overspent).toBe(0);
    });
    it('caps the extra at what is available and reports overspending', () => {
        expect(allocateIncome(2200, expenses, 400, 1000).slices.find(s => s.kind === 'extra')).toBeUndefined();
        expect(allocateIncome(3000, expenses, 400, 1000).slices.find(s => s.kind === 'extra')?.amount).toBe(550);
        expect(allocateIncome(2000, expenses, 400, 0).overspent).toBe(450);
    });
});

describe('next best action', () => {
    it('asks for income first', () => {
        expect(nextBestAction(input({ finances: finances({ monthlyNetIncome: 0 }) })).id).toBe('income');
    });
    it('flags overspending before anything else about debts', () => {
        expect(nextBestAction(input({ leftover: -200 })).id).toBe('overspent');
    });
    it('flags a missed payment', () => {
        const f = finances({ loans: [{ ...loan, dueDay: 5 }] });
        expect(nextBestAction(input({ finances: f, activeLoans: f.loans as never, now: new Date(2026, 10, 20) })).id).toBe('missed');
    });
    it('warns when DTI is above the risk limit', () => {
        expect(nextBestAction(input({ dti: 0.5 })).id).toBe('dti');
    });
    it('suggests an extra payment toward the focus debt when none is set', () => {
        const a = nextBestAction(input());
        expect(a.id).toBe('extra');
        expect(a.applyExtra).toBeGreaterThan(0);
        expect(a.applyExtra! % 25).toBe(0);
        expect(a.title).toContain('Visa');
    });
    it('says you are on track once an extra payment is set', () => {
        expect(nextBestAction(input({ settings: settings({ extraPayment: 100 }) })).id).toBe('ontrack');
    });
});

describe('plan vs actual', () => {
    it('totals what was paid per month against a flat plan', () => {
        const f = finances({ payments: [
            { id: '1', loanId: 'a', amount: 100, date: '2026-11-03', source: 'manual' },
            { id: '2', loanId: 'a', amount: 50, date: '2026-11-20', source: 'manual' },
            { id: '3', loanId: 'a', amount: 70, date: '2026-09-02', source: 'manual' },
        ] });
        const m = planVsActual(f, 250, 3, new Date(2026, 10, 25));
        expect(m.map(x => x.month)).toEqual(['2026-09', '2026-10', '2026-11']);
        expect(m.map(x => x.actual)).toEqual([70, 0, 150]);
        expect(m.every(x => x.planned === 250)).toBe(true);
    });
});

describe('milestones', () => {
    it('reports progress toward each milestone', () => {
        const f = finances();
        const ms = milestonesFor(f, summarizeProgress(f));
        const half = ms.find(m => m.id === 'p50')!;
        expect(half.done).toBe(true);
        const next = ms.find(m => !m.done)!;
        expect(next.progress).toBeGreaterThanOrEqual(0);
        expect(next.progress).toBeLessThanOrEqual(1);
        const p75 = ms.find(m => m.id === 'p75')!;
        expect(p75.done).toBe(false);
        expect(p75.progress).toBeCloseTo(50 / 75, 5);
    });
});

describe('loan test extras', () => {
    const snap = { loans: [loan] as never, netIncome: 5000, grossIncome: 6500, expensesTotal: 2000, riskProfile: RiskProfile.Average, strategy: 'avalanche' as const, extra: 0 };
    it('reports total debt before and after, and a payment override', () => {
        const r = evaluateNewLoan({ amount: 10000, apr: 6, termMonths: 60, paymentOverride: 150 }, snap);
        expect(r.totalDebtBefore).toBe(1000);
        expect(r.totalDebtAfter).toBe(11000);
        expect(r.payment).toBe(150);
    });
    it('detects negative amortization', () => {
        expect(evaluateNewLoan({ amount: 10000, apr: 24, termMonths: 60, paymentOverride: 100 }, snap).negativeAmortization).toBe(true);
        expect(evaluateNewLoan({ amount: 10000, apr: 6, termMonths: 60 }, snap).negativeAmortization).toBe(false);
    });
});

describe('tax calculator (restored)', () => {
    it('computes take-home pay and local info for a recognized ZIP', () => {
        expect(zipToState('10001')).toBe('NY');
        const { takeHome, stateCode } = computeMonthlyTakeHome(8000, 'single', 0, 0, 0, '10001');
        expect(stateCode).toBe('NY');
        expect(takeHome).toBeGreaterThan(4000);
        expect(takeHome).toBeLessThan(8000);
        expect(getLocalInfo('10001')).toBeDefined();
        expect(getStateName('NY')).toBe('New York');
        expect(getStateStdDed('NY', 'single')).toBeGreaterThan(0);
    });
    it('withholds more when pre-tax 401(k) is lower than taxes saved', () => {
        const base = computeMonthlyTakeHome(8000, 'single', 0, 0, 0, '78701').takeHome;
        const with401k = computeMonthlyTakeHome(8000, 'single', 1000, 0, 0, '78701').takeHome;
        expect(with401k).toBeLessThan(base);
        expect(base - with401k).toBeLessThan(1000);
    });
    it('returns zero without a recognized ZIP', () => {
        expect(computeMonthlyTakeHome(8000, 'single', 0, 0, 0, '').takeHome).toBe(0);
    });
});
