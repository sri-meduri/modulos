export interface RetirementInput {
    /** Current retirement savings. */
    balance: number;
    /** Added every month (401(k) plus IRA, for example). */
    monthlyContribution: number;
    /** Average yearly return in percent (nominal, before inflation). */
    annualReturnPct: number;
    years: number;
}

export interface RetirementProjection {
    /** Balance at the end of each year, index 0 = today. */
    yearly: number[];
    final: number;
    contributed: number;
    /** Final balance minus the starting balance and everything contributed. */
    growth: number;
}

/** Return assumptions offered in the UI (long-run U.S. stock/bond mixes; not guarantees). */
export const RETURN_PRESETS = [
    { value: 4, label: 'Cautious · 4%' },
    { value: 7, label: 'Average · 7%' },
    { value: 9, label: 'Growth · 9%' },
] as const;

/**
 * Steady-return projection with monthly compounding and monthly contributions.
 * It is an illustration, not a forecast: real returns swing year to year and can be negative.
 */
export const projectRetirement = ({ balance, monthlyContribution, annualReturnPct, years }: RetirementInput): RetirementProjection => {
    const months = Math.max(0, Math.round(years * 12));
    const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
    let value = Math.max(0, balance);
    const yearly = [value];
    for (let m = 1; m <= months; m++) {
        value = value * (1 + monthlyRate) + Math.max(0, monthlyContribution);
        if (m % 12 === 0 || m === months) yearly.push(value);
    }
    const contributed = Math.max(0, monthlyContribution) * months;
    return { yearly, final: value, contributed, growth: value - Math.max(0, balance) - contributed };
};
