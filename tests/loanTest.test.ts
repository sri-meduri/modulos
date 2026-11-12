import { describe, expect, it } from 'vitest';
import { evaluateNewLoan, FinanceSnapshot } from '../services/loanTest';
import { LoanType, RiskProfile } from '../types';

const snap = (over: Partial<FinanceSnapshot> = {}): FinanceSnapshot => ({
    loans: [{ id: 'a', name: 'Auto', type: LoanType.Auto, balance: 11000, apr: 7, term: 5, originalAmount: 15000 }],
    netIncome: 5000, grossIncome: 6500, expensesTotal: 2000, riskProfile: RiskProfile.Average,
    strategy: 'avalanche', extra: 0, ...over,
});

describe('evaluateNewLoan', () => {
    it('is Safe for a small loan', () => {
        const r = evaluateNewLoan({ amount: 2000, apr: 6, termMonths: 24 }, snap());
        expect(r.verdict).toBe('Safe');
        expect(r.dtiAfter).toBeGreaterThan(r.dtiBefore);
        expect(r.suggestions).toEqual([]);
    });
    it('is Borderline when DTI is inside the warning zone below the limit', () => {
        const r = evaluateNewLoan({ amount: 90000, apr: 7, termMonths: 60 }, snap());
        expect(r.dtiAfter).toBeLessThan(r.threshold);
        expect(r.verdict).toBe('Borderline');
    });
    it('is Not Recommended for a huge loan and suggests a smaller amount', () => {
        const r = evaluateNewLoan({ amount: 150000, apr: 7, termMonths: 60 }, snap());
        expect(r.verdict).toBe('Not Recommended');
        expect(r.suggestions.some(s => s.includes('Borrow'))).toBe(true);
    });
    it('flags Borderline when a 10% pay cut would leave you short', () => {
        const tight = snap({ expensesTotal: 4100 });
        const r = evaluateNewLoan({ amount: 5000, apr: 6, termMonths: 36 }, tight);
        expect(r.leftoverAfter).toBeGreaterThanOrEqual(0);
        expect(r.verdict).toBe('Borderline');
    });
    it('uses the stricter limit for a cautious profile', () => {
        const a = evaluateNewLoan({ amount: 20000, apr: 7, termMonths: 60 }, snap({ riskProfile: RiskProfile.High }));
        const b = evaluateNewLoan({ amount: 20000, apr: 7, termMonths: 60 }, snap({ riskProfile: RiskProfile.Low }));
        expect(b.threshold).toBeLessThan(a.threshold);
    });
});
