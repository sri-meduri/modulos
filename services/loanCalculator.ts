import { Loan } from '../types';

/**
 * Calculates the monthly payment for a loan using the PMT formula.
 * @param principal - The total loan amount.
 * @param annualRate - The annual interest rate (e.g., 5 for 5%).
 * @param termInYears - The loan term in years.
 * @returns The monthly payment amount.
 */
export const calculateMinimumPayment = (principal: number, annualRate: number, termInYears: number): number => {
    if (principal <= 0 || annualRate < 0 || termInYears <= 0) {
        return 0;
    }
    const monthlyRate = (annualRate / 100) / 12;
    const numberOfPayments = termInYears * 12;

    if (monthlyRate === 0) {
        return principal / numberOfPayments;
    }

    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    return isNaN(payment) || !isFinite(payment) ? 0 : payment;
};

/**
 * A loan's actual minimum payment: the user's manual override if set,
 * otherwise the calculated PMT. Single source of truth used everywhere
 * a "minimum payment" figure is needed, so overrides are never silently ignored.
 */
export const getEffectiveMinPayment = (loan: Loan): number => {
    return loan.minPaymentOverride !== undefined
        ? loan.minPaymentOverride
        : calculateMinimumPayment(loan.originalAmount > 0 ? loan.originalAmount : loan.balance, loan.apr, loan.term);
};
