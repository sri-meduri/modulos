
import { RiskProfile } from './types';

export const DTI_THRESHOLDS: { [key in RiskProfile]: number } = {
    [RiskProfile.Low]: 0.30,
    [RiskProfile.Average]: 0.36,
    [RiskProfile.High]: 0.40,
};

// One representative subcategory per EXPENSE_CATEGORIES entry below, so every
// seeded name matches a real accordion line item exactly (previously these
// diverged, e.g. "Food & Groceries" here vs. "Groceries" in the accordion).
export const STANDARD_EXPENSES = [
    'Rent',
    'Auto Insurance',
    'Groceries',
    'Life Insurance',
    'Health Insurance',
    'Daycare / Babysitter',
    'Streaming & Subscriptions',
    'Personal Care',
    'Tuition',
];

export interface ExpenseCategory {
    id: string;
    label: string;
    subcategories: { name: string; placeholder?: string }[];
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    {
        id: 'housing',
        label: 'Housing / Utilities',
        subcategories: [
            { name: 'Rent', placeholder: 'Monthly rent payment' },
            { name: 'Electricity', placeholder: 'Monthly electric bill' },
            { name: 'Water', placeholder: 'Monthly water bill' },
            { name: 'Natural Gas', placeholder: 'Monthly gas bill' },
            { name: 'Internet', placeholder: 'Monthly internet bill' },
            { name: 'Phone', placeholder: 'Monthly phone bill' },
            { name: 'Home Insurance', placeholder: 'Homeowners / renters insurance' },
            { name: 'HOA Fees', placeholder: 'Homeowners association fees' },
        ],
    },
    {
        id: 'transportation',
        label: 'Transportation',
        subcategories: [
            { name: 'Auto Insurance', placeholder: 'Car insurance premium' },
            { name: 'Gas', placeholder: 'Monthly fuel costs' },
            { name: 'Public Transit', placeholder: 'Bus, subway, train' },
            { name: 'Vehicle Maintenance', placeholder: 'Oil changes, repairs, etc.' },
            { name: 'Parking / Tolls', placeholder: 'Parking fees, tolls' },
        ],
    },
    {
        id: 'food',
        label: 'Food',
        subcategories: [
            { name: 'Groceries', placeholder: 'Monthly grocery spending' },
            { name: 'Dining Out', placeholder: 'Restaurants, takeout, delivery' },
        ],
    },
    {
        id: 'insurance_pensions',
        label: 'Personal Insurance & Pensions',
        subcategories: [
            { name: 'Life Insurance', placeholder: 'Life insurance premium' },
            { name: 'Disability Insurance', placeholder: 'Short or long-term disability' },
            { name: 'Retirement Contribution', placeholder: 'IRA, pension, annuity' },
        ],
    },
    {
        id: 'healthcare',
        label: 'Healthcare',
        subcategories: [
            { name: 'Health Insurance', placeholder: 'Monthly premium' },
            { name: 'Medical Out-of-Pocket', placeholder: 'Copays, prescriptions' },
            { name: 'Dental & Vision', placeholder: 'Dental and vision costs' },
        ],
    },
    {
        id: 'childcare',
        label: 'Child Care',
        subcategories: [
            { name: 'Daycare / Babysitter', placeholder: 'Monthly childcare costs' },
            { name: 'Child Activities', placeholder: 'Sports, clubs, after-school' },
        ],
    },
    {
        id: 'entertainment',
        label: 'Entertainment',
        subcategories: [
            { name: 'Streaming & Subscriptions', placeholder: 'Netflix, Spotify, etc.' },
            { name: 'Hobbies', placeholder: 'Hobbies and leisure activities' },
            { name: 'Dining & Events', placeholder: 'Concerts, movies, dining out for fun' },
        ],
    },
    {
        id: 'apparel',
        label: 'Apparel & Personal Care',
        subcategories: [
            { name: 'Clothing', placeholder: 'Monthly clothing budget' },
            { name: 'Personal Care', placeholder: 'Haircuts, toiletries, cosmetics' },
            { name: 'Gym & Fitness', placeholder: 'Gym membership, classes' },
        ],
    },
    {
        id: 'education',
        label: 'Education',
        subcategories: [
            { name: 'Tuition', placeholder: 'College or school tuition' },
            { name: 'Books & Supplies', placeholder: 'Textbooks, course materials' },
            { name: 'Online Courses', placeholder: 'Udemy, Coursera, etc.' },
        ],
    },
];

/** Typical APR / term per loan type, used to prefill the debt form. */
export const LOAN_PRESETS: Record<string, { apr: number; termYears: number; name: string; hint: string }> = {
    'Credit Card': { apr: 22, termYears: 5, name: 'Credit card', hint: 'Typical for a credit card' },
    'Auto': { apr: 7, termYears: 5, name: 'Auto loan', hint: 'Typical for an auto loan' },
    'Student': { apr: 5.5, termYears: 10, name: 'Student loan', hint: 'Typical for a student loan' },
    'Mortgage': { apr: 6.5, termYears: 30, name: 'Mortgage', hint: 'Typical for a 30-year mortgage' },
    'Other': { apr: 10, termYears: 3, name: 'Loan', hint: 'A rough estimate; adjust to your loan' },
};
