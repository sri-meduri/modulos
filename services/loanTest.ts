import { Loan, LoanType, RiskProfile, PayoffStrategy } from '../types';
import { DTI_THRESHOLDS } from '../constants';
import { calculateMinimumPayment } from './loanCalculator';
import { simulatePayoff } from './payoff';

export type Verdict = 'Safe' | 'Borderline' | 'Not Recommended';

export interface LoanTestInput {
    amount: number;
    apr: number;
    termMonths: number;
    /** Overrides the calculated payment (e.g. from a lender quote). */
    paymentOverride?: number;
}

export interface FinanceSnapshot {
    /** Active loans only. */
    loans: Loan[];
    netIncome: number;
    grossIncome: number;
    expensesTotal: number;
    riskProfile: RiskProfile;
    strategy: PayoffStrategy;
    customOrder?: string[];
    extra: number;
}

export interface LoanTestResult {
    verdict: Verdict;
    payment: number;
    /** True when the payment does not even cover each month's interest (the balance would grow). */
    negativeAmortization: boolean;
    totalDebtBefore: number;
    totalDebtAfter: number;
    /** 0-1 fractions. */
    dtiBefore: number;
    dtiAfter: number;
    threshold: number;
    leftoverBefore: number;
    leftoverAfter: number;
    /** Leftover after if take-home income fell 10%. */
    stressLeftover: number;
    debtFreeMonthsBefore: number;
    debtFreeMonthsAfter: number;
    neverPaysOffAfter: boolean;
    reasons: string[];
    /** "What would make this safer?" */
    suggestions: string[];
}

export const BORDERLINE_FRACTION = 0.85;

const monthlyMin = (loans: Loan[]) =>
    loans.reduce((a, l) => a + (l.minPaymentOverride ?? calculateMinimumPayment(l.originalAmount > 0 ? l.originalAmount : l.balance, l.apr, l.term)), 0);

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Risk profiles with the DTI limit each one uses, shown in the UI as "Cautious · 30%". */
export const RISK_LABELS: Record<RiskProfile, { label: string; percent: string; blurb: string }> = {
    [RiskProfile.Low]: { label: 'Cautious', percent: '30%', blurb: 'Cautious flags a loan above 30% debt-to-income.' },
    [RiskProfile.Average]: { label: 'Balanced', percent: '36%', blurb: 'Balanced flags a loan above 36% debt-to-income.' },
    [RiskProfile.High]: { label: 'Flexible', percent: '40%', blurb: 'Flexible flags a loan above 40% debt-to-income (higher risk).' },
};

/** Core affordability check. Pure so it can also drive the "make it safer" search. */
export const evaluateNewLoan = (input: LoanTestInput, snap: FinanceSnapshot, withSuggestions = true): LoanTestResult => {
    const years = input.termMonths / 12;
    const payment = input.paymentOverride !== undefined ? input.paymentOverride : calculateMinimumPayment(input.amount, input.apr, years);
    const negativeAmortization = payment < (input.amount * input.apr) / 1200 - 0.005;
    // Callers pass gross income (entered or estimated); fall back to take-home only if that is missing.
    const dtiIncome = snap.grossIncome > 0 ? snap.grossIncome : snap.netIncome;
    const threshold = DTI_THRESHOLDS[snap.riskProfile];

    const debtBefore = monthlyMin(snap.loans);
    const debtAfter = debtBefore + payment;
    const dtiBefore = dtiIncome > 0 ? debtBefore / dtiIncome : 0;
    const dtiAfter = dtiIncome > 0 ? debtAfter / dtiIncome : 0;
    const leftoverBefore = snap.netIncome - snap.expensesTotal - debtBefore;
    const leftoverAfter = leftoverBefore - payment;
    const stressLeftover = snap.netIncome * 0.9 - snap.expensesTotal - debtAfter;

    const reasons: string[] = [];
    let verdict: Verdict = 'Safe';
    if (dtiIncome <= 0) {
        verdict = 'Borderline';
        reasons.push('Add your income in Budget so we can measure this against it.');
    } else if (dtiAfter > threshold || leftoverAfter < 0) {
        verdict = 'Not Recommended';
        if (dtiAfter > threshold) reasons.push(`Debt-to-income would be ${(dtiAfter * 100).toFixed(0)}%, above your ${(threshold * 100).toFixed(0)}% limit.`);
        if (leftoverAfter < 0) reasons.push(`You would be ${money(-leftoverAfter)} short each month after bills and payments.`);
    } else if (dtiAfter > threshold * BORDERLINE_FRACTION || stressLeftover < 0) {
        verdict = 'Borderline';
        if (dtiAfter > threshold * BORDERLINE_FRACTION) reasons.push(`Debt-to-income would be ${(dtiAfter * 100).toFixed(0)}%, close to your ${(threshold * 100).toFixed(0)}% limit.`);
        if (stressLeftover < 0) reasons.push('If your take-home pay dropped 10%, you would come up short each month.');
    } else {
        reasons.push(`You would keep ${money(leftoverAfter)} a month and stay well under your ${(threshold * 100).toFixed(0)}% limit.`);
    }

    const before = simulatePayoff(snap.loans, snap.extra, snap.strategy, snap.customOrder);
    const asLoan: Loan = {
        id: '__test__', name: 'New loan', type: LoanType.Other, balance: input.amount, apr: input.apr,
        term: years, originalAmount: input.amount, status: 'active',
    };
    const after = simulatePayoff([...snap.loans, asLoan], snap.extra, snap.strategy, snap.customOrder);

    const suggestions: string[] = [];
    if (withSuggestions && verdict !== 'Safe' && input.amount > 0) {
        // Largest amount that would be Safe at the same APR and term.
        let lo = 0;
        let hi = input.amount;
        for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            const r = evaluateNewLoan({ ...input, amount: mid, paymentOverride: undefined }, snap, false);
            if (r.verdict === 'Safe') lo = mid;
            else hi = mid;
        }
        if (lo >= 500) suggestions.push(`Borrow ${money(Math.floor(lo / 100) * 100)} or less instead of ${money(input.amount)}.`);
        // Shortest longer term that would be Safe.
        for (const term of [36, 48, 60, 72, 84, 96]) {
            if (term <= input.termMonths) continue;
            if (evaluateNewLoan({ ...input, termMonths: term, paymentOverride: undefined }, snap, false).verdict === 'Safe') {
                suggestions.push(`Stretch the term to ${term} months (a longer term costs more interest overall).`);
                break;
            }
        }
        if (snap.netIncome > 0) suggestions.push('Pay down an existing balance first to free up monthly cash.');
    }

    return {
        verdict, payment, negativeAmortization, totalDebtBefore: snap.loans.reduce((a, l) => a + l.balance, 0), totalDebtAfter: snap.loans.reduce((a, l) => a + l.balance, 0) + input.amount, dtiBefore, dtiAfter, threshold, leftoverBefore, leftoverAfter, stressLeftover,
        debtFreeMonthsBefore: before.months, debtFreeMonthsAfter: after.months,
        neverPaysOffAfter: after.neverPaysOff, reasons, suggestions,
    };
};
