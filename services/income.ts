import { Finances } from '../types';
import { computeMonthlyTakeHome, zipToState } from './taxCalculator';

/** Rough share of gross pay that remains after taxes when no ZIP is known. */
const DEFAULT_TAKE_HOME_RATIO = 0.77;

type IncomeFields = Pick<Finances, 'monthlyGrossIncome' | 'monthlyNetIncome' | 'filingStatus' | 'zip' | 'monthly401kContribution' | 'annualIraContribution' | 'annualItemizedDeductions'>;

/**
 * Gross monthly income to use for debt-to-income. When the user entered gross pay
 * we use it; otherwise we estimate it from take-home pay (inverting the tax
 * calculator when a ZIP is known, a typical take-home ratio when not), so DTI is
 * always the standard gross-based figure without asking the user for anything.
 */
export const effectiveGrossIncome = (f: IncomeFields): number => {
    if (f.monthlyGrossIncome > 0) return f.monthlyGrossIncome;
    const net = f.monthlyNetIncome;
    if (net <= 0) return 0;
    const zip = f.zip ?? '';
    if (zip.length === 5 && zipToState(zip)) {
        const takeHome = (gross: number) =>
            computeMonthlyTakeHome(gross, f.filingStatus ?? 'single', f.monthly401kContribution ?? 0, f.annualIraContribution ?? 0, f.annualItemizedDeductions ?? 0, zip).takeHome;
        let lo = net;
        let hi = net * 3;
        if (takeHome(hi) >= net) {
            for (let i = 0; i < 30; i++) {
                const mid = (lo + hi) / 2;
                if (takeHome(mid) < net) lo = mid;
                else hi = mid;
            }
            return Math.round((lo + hi) / 2);
        }
    }
    return Math.round(net / DEFAULT_TAKE_HOME_RATIO);
};
