import { describe, expect, it } from 'vitest';
import { effectiveGrossIncome } from '../services/income';
import { elapsedLabel, groupAssets, netWorthTimeline, recordAssetSnapshot, retirementPerformance, snapshotLabel, snapshots, spanOf } from '../services/assets';
import { projectRetirement } from '../services/retirement';
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
    it('records a daily snapshot only once a bank is linked, and computes performance', () => {
        const manual = f({ assets: [{ id: '1', name: '401k', type: AssetType.Retirement, value: 50000 }] });
        expect(recordAssetSnapshot(manual)).toBe(manual);
        const linked = f({ assets: [{ id: 'a', name: '401k', type: AssetType.Retirement, value: 50000, plaidItemId: 'i' }] });
        const s1 = recordAssetSnapshot(linked, new Date(2026, 10, 1));
        expect(s1.assetHistory).toEqual([{ date: '2026-11-01', total: 50000, retirement: 50000, net: 50000 }]);
        // Same day, nothing changed: no new save.
        expect(recordAssetSnapshot(s1, new Date(2026, 10, 1, 18))).toBe(s1);
        // Next day, nothing changed: a new point is still added so the line is continuous.
        const day2 = recordAssetSnapshot(s1, new Date(2026, 10, 2));
        expect(day2.assetHistory).toHaveLength(2);
        // Same day, value moved: that day's point is updated rather than duplicated.
        const moved = recordAssetSnapshot({ ...day2, assets: [{ ...linked.assets![0], value: 52000 }] }, new Date(2026, 10, 2, 9));
        expect(moved.assetHistory).toHaveLength(2);
        const later = recordAssetSnapshot({ ...moved, assets: [{ ...linked.assets![0], value: 55000 }] }, new Date(2026, 10, 12));
        const perf = retirementPerformance(later)!;
        expect(perf.change).toBe(5000);
        expect(perf.percent).toBeCloseTo(0.1, 6);
        expect(perf.days).toBe(11);
        expect(retirementPerformance(s1)).toBeNull();
        expect(netWorthTimeline(later).map(p => p.net)).toEqual([50000, 52000, 55000]);
    });
    it('reads older monthly entries as mid-month and upgrades them to daily', () => {
        const legacy = f({
            assets: [{ id: 'a', name: '401k', type: AssetType.Retirement, value: 60000, plaidItemId: 'i' }],
            assetHistory: [{ month: '2026-09', total: 50000, retirement: 50000, net: 50000 }],
        });
        expect(snapshots(legacy)[0].date).toBe('2026-09-15');
        const upgraded = recordAssetSnapshot(legacy, new Date(2026, 10, 1));
        expect(upgraded.assetHistory!.every(h => h.date && !h.month)).toBe(true);
        expect(upgraded.assetHistory).toHaveLength(2);
    });
    it('labels snapshots and spans in whole words', () => {
        expect(elapsedLabel(1)).toBe('1 day');
        expect(elapsedLabel(12)).toBe('12 days');
        expect(elapsedLabel(95)).toBe('3 months');
        expect(snapshotLabel('2026-11-12', 30)).toBe('Nov 12');
        expect(snapshotLabel('2026-11-12', 300)).toBe('Nov 2026');
        expect(spanOf(['2026-11-01', '2026-11-12'])).toBe(11);
    });
    it('net worth subtracts active debt and counts manual assets too', () => {
        const f2 = f({
            assets: [{ id: 'a', name: '401k', type: AssetType.Retirement, value: 50000, plaidItemId: 'i' }, { id: 'h', name: 'Home', type: AssetType.RealEstate, value: 300000 }],
            loans: [{ id: 'l', name: 'Mortgage', type: LoanType.Mortgage, balance: 200000, apr: 6, term: 30, originalAmount: 250000 }],
        });
        expect(recordAssetSnapshot(f2, new Date(2026, 8, 15)).assetHistory![0].net).toBe(150000);
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

describe('retirement predictor', () => {
    it('compounds a balance with monthly contributions', () => {
        const r = projectRetirement({ balance: 50000, monthlyContribution: 500, annualReturnPct: 7, years: 30 });
        expect(r.yearly).toHaveLength(31);
        expect(r.yearly[0]).toBe(50000);
        expect(r.final).toBeGreaterThan(960000);
        expect(r.final).toBeLessThan(970000);
        expect(r.contributed).toBe(180000);
        expect(r.growth).toBeCloseTo(r.final - 50000 - 180000, 4);
    });
    it('with a zero return is just balance plus contributions', () => {
        const r = projectRetirement({ balance: 1000, monthlyContribution: 100, annualReturnPct: 0, years: 2 });
        expect(r.final).toBeCloseTo(3400, 6);
    });
    it('handles no time horizon', () => {
        const r = projectRetirement({ balance: 1000, monthlyContribution: 100, annualReturnPct: 7, years: 0 });
        expect(r.yearly).toEqual([1000]);
        expect(r.final).toBe(1000);
    });
});
