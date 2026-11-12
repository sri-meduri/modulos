
import { RiskProfile } from './types';

export const US_STATES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
    FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
    IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
    ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
    MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
    NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
    NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
    PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
    TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
    WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
};

export const CITIES = {
    Birmingham: { state: 'AL', name: 'Birmingham, AL (1.0%)' }, Gadsden: { state: 'AL', name: 'Gadsden, AL (2.0%)' },
    Mobile: { state: 'AL', name: 'Mobile, AL (1.0%)' }, Montgomery: { state: 'AL', name: 'Montgomery, AL (1.0%)' },
    SanFrancisco: { state: 'CA', name: 'San Francisco, CA (0.38%)' }, DC: { state: 'DC', name: 'District of Columbia (4%-8.5%)' },
    Wilmington: { state: 'DE', name: 'Wilmington, DE (1.25%)' }, CedarRapids: { state: 'IA', name: 'Cedar Rapids, IA (1.75%)' },
    Davenport: { state: 'IA', name: 'Davenport, IA (1.5%)' }, Wichita: { state: 'KS', name: 'Wichita, KS (1.0%)' },
    Louisville: { state: 'KY', name: 'Louisville, KY (2.2%)' }, Lexington: { state: 'KY', name: 'Lexington, KY (2.25%)' },
    Baltimore: { state: 'MD', name: 'Baltimore, MD (3.2%)' }, MontgomeryCounty: { state: 'MD', name: 'Montgomery County, MD (3.2%)' },
    Detroit: { state: 'MI', name: 'Detroit, MI (2.4%)' }, GrandRapids: { state: 'MI', name: 'Grand Rapids, MI (1.5%)' },
    Flint: { state: 'MI', name: 'Flint, MI (1.8%)' }, KansasCity: { state: 'MO', name: 'Kansas City, MO (1.0%)' },
    StLouis: { state: 'MO', name: 'St. Louis, MO (1.0%)' }, Newark: { state: 'NJ', name: 'Newark, NJ (1.0%)' },
    JerseyCity: { state: 'NJ', name: 'Jersey City, NJ (1.5%)' }, Paterson: { state: 'NJ', name: 'Paterson, NJ (1.5%)' },
    NYC: { state: 'NY', name: 'New York City, NY (3.078%-3.876%)' }, Yonkers: { state: 'NY', name: 'Yonkers, NY (16.75% of state tax)' },
    Cincinnati: { state: 'OH', name: 'Cincinnati, OH (1.8%)' }, Cleveland: { state: 'OH', name: 'Cleveland, OH (2.5%)' },
    Columbus: { state: 'OH', name: 'Columbus, OH (2.5%)' }, Dayton: { state: 'OH', name: 'Dayton, OH (2.5%)' },
    Toledo: { state: 'OH', name: 'Toledo, OH (2.25%)' }, Akron: { state: 'OH', name: 'Akron, OH (2.5%)' },
    Pittsburgh: { state: 'PA', name: 'Pittsburgh, PA (3.0%)' }, Philadelphia: { state: 'PA', name: 'Philadelphia, PA (3.8809%)' },
    Erie: { state: 'PA', name: 'Erie, PA (3.07%)' }, Reading: { state: 'PA', name: 'Reading, PA (1.0%)' },
    Scranton: { state: 'PA', name: 'Scranton, PA (3.4%)' }
};

export const LOAN_TERMS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30];

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
