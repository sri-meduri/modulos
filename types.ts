
export interface Loan {
    id: string;
    name: string;
    type: LoanType;
    balance: number;
    apr: number;
    term: number; // in years
    originalAmount: number;
    monthlyPropertyTax?: number;
    minPaymentOverride?: number;
    /** Set when imported via Plaid; links the loan to a connected bank. */
    plaidItemId?: string;
    institutionName?: string;
    /** Lifecycle: 'considering' = what-if (not counted in totals), 'paid_off' = done. Missing = active. */
    status?: DebtStatus;
    /** Day of month the payment is due (1-31), when known (Plaid or user). */
    dueDay?: number;
    /** Optional Plaid account id, used to match outgoing payments. */
    plaidAccountId?: string;
}

export type DebtStatus = 'active' | 'considering' | 'paid_off';

export type PayoffStrategy = 'avalanche' | 'snowball' | 'custom';

/** A logged debt payment (manual, or detected from a linked bank). */
export interface Payment {
    id: string;
    loanId: string;
    amount: number;
    /** ISO date (YYYY-MM-DD). */
    date: string;
    source: 'manual' | 'detected';
    /** Portion above the loan's minimum payment. */
    extra?: number;
    /** Detected payments start unconfirmed; the first per debt is confirmed by the user. */
    confirmed?: boolean;
    payee?: string;
}

/** An outgoing bank transaction that looks like a debt payment but matched no debt. */
export interface PaymentCandidate {
    id: string;
    date: string;
    amount: number;
    payee: string;
    plaidItemId?: string;
}

export interface Expense {
    id: string;
    name: string;
    amount: number;
    /** Category label (see EXPENSE_CATEGORIES); missing = guessed from the name, else "Other". */
    category?: string;
    /** Set when imported via Plaid; links the expense to a connected bank. */
    plaidItemId?: string;
    institutionName?: string;
}

export enum AssetType {
    Cash = "Cash",
    Retirement = "Retirement",
    Investment = "Investment",
    RealEstate = "Real Estate",
    Vehicle = "Vehicle",
    Other = "Other",
}

/** Something owned (cash, retirement, home value...). Counts toward net worth. */
export interface Asset {
    id: string;
    name: string;
    type: AssetType;
    value: number;
    /** Set when imported via Plaid; links the asset to a connected bank. */
    plaidItemId?: string;
    institutionName?: string;
}

export enum LoanType {
    CreditCard = "Credit Card",
    Mortgage = "Mortgage",
    Auto = "Auto",
    Student = "Student",
    Other = "Other",
}

export enum RiskProfile {
    Low = 'Low',
    Average = 'Average',
    High = 'High',
}

/** A recorded monthly total of net income and expenses, keyed by 'YYYY-MM'. */
export interface MonthlyFinanceSnapshot {
    month: string; // 'YYYY-MM'
    income: number;
    expenses: number;
}

export interface Finances {
    incomeType: 'gross' | 'net';
    monthlyGrossIncome: number;
    monthlyNetIncome: number;
    filingStatus: 'single' | 'married';
    zip: string;
    monthly401kContribution: number;
    annualIraContribution: number;
    annualItemizedDeductions: number;
    expenses: Expense[];
    loans: Loan[];
    /** Optional for records saved before assets existed; treat missing as []. */
    assets?: Asset[];
    /** Logged + detected debt payments. Optional for records saved before progress tracking. */
    payments?: Payment[];
    /** Rolling history of the last 12 months of income vs. expenses. */
    incomeExpenseHistory?: MonthlyFinanceSnapshot[];
    /** Month-end total of active debt balances, for the real history chart. */
    balanceHistory?: { month: string; balance: number }[];
    /** Daily snapshots of bank-linked balances and net worth (Assets tab). */
    assetHistory?: { date?: string; /** Older monthly entries; read as mid-month. */ month?: string; total: number; retirement: number; /** All assets minus active debt. */ net?: number }[];
}

export interface Settings {
    riskProfile: RiskProfile;
    /** Chosen payoff method. */
    strategy?: PayoffStrategy;
    /** Extra monthly payment applied by the plan. */
    extraPayment?: number;
    /** Loan ids in priority order for the 'custom' strategy. */
    customOrder?: string[];
    /** Optional target debt-free date (YYYY-MM). */
    targetDate?: string;
    /** First-run flow finished (or skipped). */
    onboardingDone?: boolean;
    /** User dismissed the 'connect a bank' nudge on Overview. */
    bankNudgeDismissed?: boolean;
    /** Payee names the user confirmed as debt payments: { payee: loanId }. */
    payeeRules?: Record<string, string>;
    /** Candidate payments the user said are NOT debt payments. */
    ignoredCandidates?: string[];
}
