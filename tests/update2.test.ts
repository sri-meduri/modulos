import { describe, expect, it } from 'vitest';
import { effectiveGrossIncome } from '../services/income';
import { monthlyPaymentPlan, paymentPlanCalendar, paymentPlanText } from '../services/payPlan';
import { groupAssets, recordAssetSnapshot, retirementPerformance } from '../services/assets';
import { compactMoney, niceTicks } from '../lib/format';
import { formatDuration } from '../services/payoff';
import { checkpoints } from '../lib/chartTicks';
import { computeMonthlyTakeHome } from '../services/taxCalculator';
import { allocateIncome, expenseCategory } from '../services/allocation';
import { AssetType, Finances, LoanType } from '../types';

const base = { monthlyGrossIncome: 0, monthlyNetIncome: 5000, filingStatus: 'single' as const, zip: '', monthly401kContribution: 0, annualIraContribution: 0, annualItemizedDeductions: 0 };
const loans = [
    { id: 'card', name: 'Visa', type: LoanType.CreditCard, balance: 3000, apr: 22, term: 5, originalAmount: 3000, minPaymentOverride: 90, dueDay: 12 },
    { id: 'auto', name: 'Auto', type: LoanType.Auto, balance: 11000, apr: 7, term: 5, originalAmount: 15000 },
];

describe('effectiveGrossIncome (auto gross for DTI)', () => {
    it('uses entered gross income as is', () => {
        expect(effectiveGrossIncome({ ...base, monthlyGrossIncome: 7000 })).toBe(7000);
    });
    it('estimates gross from take-home with no ZIP', () => {
        const g = effectiveGrossIncome(base);
        expect(g).toBeGreaterThan(5000);
        expect(g).toBeLessThan(8000);
    });
    it('inverts the tax calculator when a ZIP is known', () => {
        const net = 5000;
        const g = effectiveGrossIncome({ ...base, monthlyNetIncome: net, zip: '10001' });
        const back = computeMonthlyTakeHome(g, 'single', 0, 0, 0, '10001').takeHome;
        expect(Math.abs(back - net)).toBeLessThan(15);
    });
    it('is zero with no income', () => {
        expect(effectiveGrossIncome({ ...base, monthlyNetIncome: 0 })).toBe(0);
    });
});

describe('payment plan (put it into action)', () => {
    it('puts the whole extra on the focus debt and keeps minimums on the rest', () => {
        const plan = monthlyPaymentPlan(loans as never, 200, 'avalanche');
        expect(plan[0].loanId).toBe('card');
        expect(plan[0].amount).toBe(290);
        expect(plan[0].isFocus).toBe(true);
        expect(plan[1].extra).toBe(0);
        expect(plan[0].dayOfMonth).toBe(12);
        expect(plan[1].dueKnown).toBe(false);
    });
    it('builds a monthly recurring calendar with a reminder per debt', () => {
        const ics = paymentPlanCalendar(monthlyPaymentPlan(loans as never, 200, 'avalanche'), new Date(Date.UTC(2026, 10, 1)));
        expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
        expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
        expect(ics).toContain('RRULE:FREQ=MONTHLY');
        expect(ics).toContain('SUMMARY:Pay $290 to Visa');
        expect(ics).toContain('DTSTART;VALUE=DATE:20261112');
    });
    it('describes the plan as text for sharing', () => {
        const text = paymentPlanText(monthlyPaymentPlan(loans as never, 200, 'avalanche'));
        expect(text).toContain('Visa: $290 (includes $200 extra) by the 12th');
    });
});

describe('assets', () => {
    const f = (over: Partial<Finances> = {}): Finances => ({ ...base, expenses: [], loans: [], incomeType: 'net', ...over } as Finances);
    it('groups by type with shares that sum to 1', () => {
        const g = groupAssets([
            { id: '1', name: 'Home', type: AssetType.RealEstate, value: 300000 },
            { id: '2', name: '401k', type: AssetType.Retirement, value: 90000 },
            { id: '3', name: 'IRA', type: AssetType.Retirement, value: 10000 },
        ]);
        expect(g.map(x => x.type)).toEqual([AssetType.RealEstate, AssetType.Retirement]);
        expect(g[1].total).toBe(100000);
        expect(g[1].count).toBe(2);
        expect(g.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 6);
    });
    it('records snapshots only for bank-linked assets, once per month, and computes performance', () => {
        const manual = f({ assets: [{ id: '1', name: '401k', type: AssetType.Retirement, value: 50000 }] });
        expect(recordAssetSnapshot(manual)).toBe(manual);
        const linked = f({ assets: [{ id: 'a', name: '401k', type: AssetType.Retirement, value: 50000, plaidItemId: 'i' }] });
        const s1 = recordAssetSnapshot(linked, new Date(2026, 8, 15));
        expect(s1.assetHistory).toEqual([{ month: '2026-09', total: 50000, retirement: 50000 }]);
        expect(recordAssetSnapshot(s1, new Date(2026, 8, 20))).toBe(s1);
        const later = recordAssetSnapshot({ ...s1, assets: [{ ...linked.assets![0], value: 55000 }] }, new Date(2026, 10, 3));
        const perf = retirementPerformance(later)!;
        expect(perf.change).toBe(5000);
        expect(perf.percent).toBeCloseTo(0.1, 6);
        expect(perf.months).toBe(1);
        expect(retirementPerformance(s1)).toBeNull();
    });
});

describe('chart helpers', () => {
    it('formats compact money for axes', () => {
        expect(compactMoney(950)).toBe('$950');
        expect(compactMoney(2500)).toBe('$2.5k');
        expect(compactMoney(25000)).toBe('$25k');
        expect(compactMoney(1200000)).toBe('$1.2M');
    });
    it('makes round axis ticks that cover the max', () => {
        const t = niceTicks(245000);
        expect(t[0]).toBe(0);
        expect(t[t.length - 1]).toBeGreaterThanOrEqual(245000);
        expect(t.length).toBeLessThanOrEqual(6);
        expect(t.every(v => v % 25000 === 0 || v % 50000 === 0 || v % 100000 === 0)).toBe(true);
    });
    it('picks a few evenly spaced checkpoints including first and last', () => {
        const labels = Array.from({ length: 30 }, (_, i) => `m${i}`);
        const c = checkpoints(labels, 4);
        expect(c).toHaveLength(4);
        expect(c[0].at).toBe(0);
        expect(c[3].at).toBe(29);
    });
});

describe('wording and categories', () => {
    it('spells durations in full words', () => {
        expect(formatDuration(14)).toBe('1 year 2 months');
        expect(formatDuration(24)).toBe('2 years');
        expect(formatDuration(1)).toBe('1 month');
        expect(formatDuration(14)).not.toMatch(/mos|yrs/);
    });
    it('uses an explicit category before guessing from the name', () => {
        expect(expenseCategory({ id: 'x', name: 'Rent', amount: 1, category: 'Other' })).toBe('Other');
        expect(expenseCategory({ id: 'Rent', name: 'Rent', amount: 1 })).toBe('Housing / Utilities');
        expect(expenseCategory({ id: 'gym', name: 'Gym membership', amount: 1 })).toBe('Other');
        const r = allocateIncome(5000, [{ id: 'a', name: 'Pet', amount: 100, category: 'Other' }], 0, 0);
        expect(r.slices.find(s => s.label === 'Other')?.amount).toBe(100);
    });
});
