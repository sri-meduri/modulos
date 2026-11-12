import { Asset, AssetType, Finances, Expense, Loan, LoanType, RiskProfile, Settings } from '../types';

/**
 * "Try a Sample" profile: a household that reflects the average American
 * (about $104K gross income, a fixed-rate mortgage, a car loan, student
 * loans and a credit card balance).
 *
 * Income and expenses are tuned so the app's own figures line up with the
 * reference profile: $6,200/mo take-home, $622/mo discretionary spending,
 * and a $415/mo leftover margin after all expenses and loan minimums.
 * Assets total $439,500 against $245,000 of debt: a $194,500 net worth.
 */

const MORTGAGE_ID = 'sample-mortgage';

const loans = (): Loan[] => [
    {
        id: MORTGAGE_ID,
        name: 'Primary Mortgage',
        type: LoanType.Mortgage,
        balance: 210000,
        apr: 6.5,
        term: 30,
        originalAmount: 230000,
        monthlyPropertyTax: 292,
    },
    {
        id: 'sample-auto',
        name: 'Auto Loan',
        type: LoanType.Auto,
        balance: 18000,
        apr: 7.5,
        term: 5,
        originalAmount: 22000,
    },
    {
        id: 'sample-credit-card',
        name: 'Credit Card',
        type: LoanType.CreditCard,
        balance: 6000,
        apr: 22.36,
        term: 1,
        originalAmount: 6000,
        // Revolving debt has no term; model a typical ~2.5% minimum payment.
        minPaymentOverride: 150,
    },
    {
        id: 'sample-student',
        name: 'Student Loans',
        type: LoanType.Student,
        balance: 11000,
        apr: 6.52,
        term: 10,
        originalAmount: 14000,
    },
];

const expenses = (): Expense[] => [
    // Core living expenses (excluding loan payments, which the app tracks separately)
    { id: 'property-tax-' + MORTGAGE_ID, name: 'Property Tax', amount: 292 },
    { id: 'Electricity', name: 'Electricity', amount: 140 },
    { id: 'Water', name: 'Water', amount: 55 },
    { id: 'Natural Gas', name: 'Natural Gas', amount: 70 },
    { id: 'Internet', name: 'Internet', amount: 75 },
    { id: 'Phone', name: 'Phone', amount: 110 },
    { id: 'Home Insurance', name: 'Home Insurance', amount: 150 },
    { id: 'Auto Insurance', name: 'Auto Insurance', amount: 160 },
    { id: 'Gas', name: 'Gas', amount: 230 },
    { id: 'Vehicle Maintenance', name: 'Vehicle Maintenance', amount: 90 },
    { id: 'Groceries', name: 'Groceries', amount: 900 },
    { id: 'Life Insurance', name: 'Life Insurance', amount: 45 },
    { id: 'Health Insurance', name: 'Health Insurance', amount: 480 },
    { id: 'Medical Out-of-Pocket', name: 'Medical Out-of-Pocket', amount: 162 },
    // Discretionary & misc.
    { id: 'Clothing', name: 'Clothing', amount: 150 },
    { id: 'Streaming & Subscriptions', name: 'Streaming & Subscriptions', amount: 60 },
    { id: 'Hobbies', name: 'Hobbies', amount: 120 },
    { id: 'Dining & Events', name: 'Dining & Events', amount: 140 },
    { id: 'Personal Care', name: 'Personal Care', amount: 80 },
    { id: 'Books & Supplies', name: 'Books & Supplies', amount: 72 },
];

const assets = (): Asset[] => [
    { id: 'sample-home', name: 'Home Value', type: AssetType.RealEstate, value: 350000 },
    { id: 'sample-401k', name: 'Employer 401(k)', type: AssetType.Retirement, value: 85000 },
    { id: 'sample-savings', name: 'Emergency Fund', type: AssetType.Cash, value: 4500 },
];

export const createSampleFinances = (): Finances => {
    const sampleExpenses = expenses();
    const monthlyNetIncome = 6200;
    return {
        incomeType: 'net',
        monthlyGrossIncome: Math.round(104207 / 12),
        monthlyNetIncome,
        filingStatus: 'married',
        zip: '',
        monthly401kContribution: 0,
        annualIraContribution: 0,
        annualItemizedDeductions: 0,
        expenses: sampleExpenses,
        loans: loans(),
        assets: assets(),
    };
};

export const createSampleSettings = (): Settings => ({
    riskProfile: RiskProfile.Average,
});
