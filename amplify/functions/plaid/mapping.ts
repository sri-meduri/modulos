/**
 * Pure mapping from Plaid API responses to the app's Loan/Expense shapes
 * (mirrors types.ts — kept structural here since the Lambda bundle should
 * not import frontend modules).
 */
import type {
  LiabilitiesGetResponse,
  TransactionStream,
  Transaction,
  AccountBase,
} from 'plaid';

export interface MappedLoan {
  id: string;
  name: string;
  type: 'Credit Card' | 'Mortgage' | 'Auto' | 'Student' | 'Other';
  balance: number;
  apr: number;
  term: number; // years
  originalAmount: number;
  minPaymentOverride?: number;
  plaidItemId: string;
  institutionName?: string;
  /** Plaid account id, so outgoing payments can be matched to this loan. */
  plaidAccountId?: string;
  /** Day of month the next payment is due, when Plaid supplies it. */
  dueDay?: number;
}

export interface MappedExpense {
  id: string;
  name: string;
  amount: number;
  plaidItemId: string;
  institutionName?: string;
}

export interface MappedAsset {
  id: string;
  name: string;
  type: 'Cash' | 'Retirement' | 'Investment' | 'Real Estate' | 'Vehicle' | 'Other';
  value: number;
  plaidItemId: string;
  institutionName?: string;
}

/** One aggregated month of income vs. expenses (mirrors MonthlyFinanceSnapshot). */
export interface MappedMonthlySnapshot {
  month: string; // 'YYYY-MM'
  income: number;
  expenses: number;
}

const accountName = (account: AccountBase | undefined, fallback: string): string => {
  if (!account) return fallback;
  const mask = account.mask ? ` ••${account.mask}` : '';
  return `${account.name}${mask}`;
};

const yearsUntil = (dateStr: string | null | undefined, min: number, fallback: number): number => {
  if (!dateStr) return fallback;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return fallback;
  const years = (target - Date.now()) / (365.25 * 24 * 3600 * 1000);
  return years > 0 ? Math.max(min, Math.ceil(years)) : fallback;
};

const yearsBetween = (start: string | null | undefined, end: string | null | undefined): number | null => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.round((e - s) / (365.25 * 24 * 3600 * 1000));
};

const RETIREMENT_SUBTYPES = new Set([
  '401a', '401k', '403b', '457b', 'ira', 'roth', 'roth 401k', 'sep ira', 'simple ira',
  'sarsep', 'keogh', 'pension', 'retirement', 'profit sharing plan', 'thrift savings plan',
]);

/**
 * Maps Plaid accounts to owned assets: bank accounts become Cash, and
 * investment accounts become Retirement (401k/IRA/pension...) or Investment.
 * Credit and loan accounts are liabilities (handled as loans) and skipped.
 */
export function mapAccountsToAssets(
  accounts: AccountBase[],
  itemId: string,
  institutionName?: string
): MappedAsset[] {
  const assets: MappedAsset[] = [];
  for (const account of accounts) {
    let type: MappedAsset['type'];
    if (account.type === 'depository') {
      type = 'Cash';
    } else if (account.type === 'investment') {
      type = RETIREMENT_SUBTYPES.has(String(account.subtype ?? '').toLowerCase())
        ? 'Retirement'
        : 'Investment';
    } else {
      continue;
    }
    const value = account.balances.current ?? 0;
    if (value <= 0) continue;
    assets.push({
      id: `plaid-asset-${account.account_id}`,
      name: accountName(account, 'Account'),
      type,
      value,
      plaidItemId: itemId,
      institutionName,
    });
  }
  return assets;
}

const dueDayOf = (iso: string | null | undefined): { dueDay?: number } => {
  if (!iso) return {};
  const day = parseInt(iso.slice(8, 10), 10);
  return day >= 1 && day <= 31 ? { dueDay: day } : {};
};

export function mapLiabilitiesToLoans(
  response: LiabilitiesGetResponse,
  itemId: string,
  institutionName?: string
): MappedLoan[] {
  const accounts = new Map(response.accounts.map((acc) => [acc.account_id, acc]));
  const loans: MappedLoan[] = [];
  const liabilityAccountIds = new Set<string>();

  for (const credit of response.liabilities.credit ?? []) {
    if (!credit.account_id) continue;
    liabilityAccountIds.add(credit.account_id);
    const account = accounts.get(credit.account_id);
    const purchaseApr =
      credit.aprs.find((a) => a.apr_type === 'purchase_apr') ?? credit.aprs[0];
    const balance = account?.balances.current ?? credit.last_statement_balance ?? 0;
    loans.push({
      id: `plaid-${credit.account_id}`,
      name: accountName(account, 'Credit Card'),
      type: 'Credit Card',
      balance,
      apr: purchaseApr?.apr_percentage ?? 0,
      term: 5,
      originalAmount: balance,
      ...(credit.minimum_payment_amount != null && credit.minimum_payment_amount > 0
        ? { minPaymentOverride: credit.minimum_payment_amount }
        : {}),
      plaidItemId: itemId,
      institutionName,
      plaidAccountId: credit.account_id,
      ...dueDayOf(credit.next_payment_due_date),
    });
  }

  for (const mortgage of response.liabilities.mortgage ?? []) {
    if (!mortgage.account_id) continue;
    liabilityAccountIds.add(mortgage.account_id);
    const account = accounts.get(mortgage.account_id);
    const balance = account?.balances.current ?? 0;
    const termFromLabel = mortgage.loan_term
      ? parseInt(mortgage.loan_term, 10)
      : NaN;
    const term = !Number.isNaN(termFromLabel) && termFromLabel > 0
      ? termFromLabel
      : yearsBetween(mortgage.origination_date, mortgage.maturity_date) ?? 30;
    loans.push({
      id: `plaid-${mortgage.account_id}`,
      name: accountName(account, 'Mortgage'),
      type: 'Mortgage',
      balance,
      apr: mortgage.interest_rate?.percentage ?? 0,
      term,
      originalAmount: mortgage.origination_principal_amount ?? balance,
      ...(mortgage.next_monthly_payment != null && mortgage.next_monthly_payment > 0
        ? { minPaymentOverride: mortgage.next_monthly_payment }
        : {}),
      plaidItemId: itemId,
      institutionName,
      plaidAccountId: mortgage.account_id,
      ...dueDayOf(mortgage.next_payment_due_date),
    });
  }

  for (const student of response.liabilities.student ?? []) {
    if (!student.account_id) continue;
    liabilityAccountIds.add(student.account_id);
    const account = accounts.get(student.account_id);
    const balance = account?.balances.current ?? 0;
    loans.push({
      id: `plaid-${student.account_id}`,
      name: accountName(account, 'Student Loan'),
      type: 'Student',
      balance,
      apr: student.interest_rate_percentage ?? 0,
      term: yearsUntil(student.expected_payoff_date, 1, 10),
      originalAmount: student.origination_principal_amount ?? balance,
      ...(student.minimum_payment_amount != null && student.minimum_payment_amount > 0
        ? { minPaymentOverride: student.minimum_payment_amount }
        : {}),
      plaidItemId: itemId,
      institutionName,
      plaidAccountId: student.account_id,
      ...dueDayOf(student.next_payment_due_date),
    });
  }

  // Loan-type accounts with no liability detail object (e.g. auto loans)
  for (const account of response.accounts) {
    if (account.type !== 'loan' || liabilityAccountIds.has(account.account_id)) continue;
    const balance = account.balances.current ?? 0;
    if (balance <= 0) continue;
    const isAuto = account.subtype === 'auto';
    loans.push({
      id: `plaid-${account.account_id}`,
      name: accountName(account, isAuto ? 'Auto Loan' : 'Loan'),
      type: isAuto ? 'Auto' : 'Other',
      balance,
      apr: 0, // Plaid doesn't provide it here; user fills in
      term: 5,
      originalAmount: balance,
      plaidItemId: itemId,
      institutionName,
      plaidAccountId: account.account_id,
    });
  }

  return loans;
}

/** Categories that would double-count against loan minimum payments. */
const EXCLUDED_PRIMARY_CATEGORIES = new Set(['LOAN_PAYMENTS', 'TRANSFER_OUT']);

const MONTHLY_FACTOR: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMI_MONTHLY: 2,
  MONTHLY: 1,
  ANNUALLY: 1 / 12,
  UNKNOWN: 1,
};

export function mapRecurringToExpenses(
  outflowStreams: TransactionStream[],
  itemId: string,
  institutionName?: string
): MappedExpense[] {
  const expenses: MappedExpense[] = [];
  for (const stream of outflowStreams) {
    if (!stream.is_active) continue;
    const primary = stream.personal_finance_category?.primary;
    if (primary && EXCLUDED_PRIMARY_CATEGORIES.has(primary)) continue;
    const rawAmount = Math.abs(stream.average_amount?.amount ?? 0);
    if (rawAmount <= 0) continue;
    const factor = MONTHLY_FACTOR[stream.frequency] ?? 1;
    expenses.push({
      id: `plaid-recurring-${stream.stream_id}`,
      name: stream.merchant_name || stream.description || 'Recurring payment',
      amount: Math.round(rawAmount * factor * 100) / 100,
      plaidItemId: itemId,
      institutionName,
    });
  }
  return expenses;
}

/**
 * Movements between the user's own accounts (checking->savings, investment
 * sweeps) — excluded from cash-flow numbers. P2P payments (Zelle, Venmo)
 * are deliberately NOT here: for most households they are real spending
 * (rent, splitting bills) or real money received.
 */
const INTERNAL_TRANSFER_DETAILED = new Set([
  'TRANSFER_IN_ACCOUNT_TRANSFER',
  'TRANSFER_IN_SAVINGS',
  'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS',
  'TRANSFER_OUT_ACCOUNT_TRANSFER',
  'TRANSFER_OUT_SAVINGS',
  'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS',
]);

/**
 * True when a transaction should not count toward income/expense numbers:
 * loan payments (tracked separately as debt) and own-account transfers.
 */
const isExcludedFromCashFlow = (txn: Transaction): boolean => {
  const primary = txn.personal_finance_category?.primary;
  if (primary === 'LOAN_PAYMENTS') return true;
  if (primary === 'TRANSFER_IN' || primary === 'TRANSFER_OUT') {
    const detailed = txn.personal_finance_category?.detailed;
    // Unknown transfer subtype: err toward excluding (could be own-account).
    if (!detailed) return true;
    return INTERNAL_TRANSFER_DETAILED.has(detailed);
  }
  return false;
};

/** The last 12 calendar-month keys ('YYYY-MM'), oldest first, including `now`'s month. */
export function last12MonthKeys(now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

/**
 * Aggregates raw Plaid transactions into a rolling 12-month income vs. expense
 * history. Plaid's sign convention: a positive `amount` is money leaving the
 * account (an expense) and a negative `amount` is money entering it (income).
 * INCOME-categorized inflows are summed as income; other outflows as expenses.
 */
export function mapTransactionsToMonthlyHistory(
  transactions: Transaction[],
  now: Date = new Date()
): MappedMonthlySnapshot[] {
  const months = last12MonthKeys(now);
  const byMonth = new Map<string, { income: number; expenses: number }>();
  months.forEach((m) => byMonth.set(m, { income: 0, expenses: 0 }));

  for (const txn of transactions) {
    if (txn.pending) continue;
    const month = (txn.date ?? '').slice(0, 7);
    const bucket = byMonth.get(month);
    if (!bucket) continue; // Outside the 12-month window.

    if (isExcludedFromCashFlow(txn)) continue;

    const primary = txn.personal_finance_category?.primary;
    const amount = txn.amount ?? 0;
    if (primary === 'INCOME' || amount < 0) {
      bucket.income += Math.abs(amount);
    } else if (amount > 0) {
      bucket.expenses += amount;
    }
  }

  return months.map((m) => {
    const b = byMonth.get(m)!;
    return {
      month: m,
      income: Math.round(b.income * 100) / 100,
      expenses: Math.round(b.expenses * 100) / 100,
    };
  });
}

const median = (values: number[]): number => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const DAY_MS = 24 * 3600 * 1000;

/**
 * Fallback subscription detection from raw transactions, used when Plaid's
 * Recurring Transactions endpoint is unavailable (gated add-on on some
 * plans). Conservative heuristic: same merchant, >= 3 occurrences, a steady
 * weekly/biweekly/monthly cadence, consistent amounts, still active within
 * the last 45 days. Amounts are monthly-ized like the Plaid-stream path.
 */
export function detectRecurringExpenses(
  transactions: Transaction[],
  itemId: string,
  institutionName?: string
): MappedExpense[] {
  const groups = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    if (txn.pending) continue;
    if ((txn.amount ?? 0) <= 0) continue; // inflows are not expenses
    if (isExcludedFromCashFlow(txn)) continue; // loan payments, own-account moves
    if (txn.personal_finance_category?.primary === 'INCOME') continue;
    const key = (txn.merchant_name || txn.name || '').trim().toLowerCase();
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(txn);
    groups.set(key, list);
  }

  const detected: MappedExpense[] = [];
  for (const [key, txns] of groups) {
    if (txns.length < 3) continue;
    const sorted = txns.slice().sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    const lastDate = new Date(sorted[sorted.length - 1].date ?? 0).getTime();
    if (Date.now() - lastDate > 45 * DAY_MS) continue; // no longer active

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(
        (new Date(sorted[i].date ?? 0).getTime() - new Date(sorted[i - 1].date ?? 0).getTime()) / DAY_MS
      );
    }
    const cadence = median(intervals);
    let monthlyFactor: number | null = null;
    if (cadence >= 5.5 && cadence <= 8.5) monthlyFactor = 52 / 12;
    else if (cadence >= 12 && cadence <= 16.5) monthlyFactor = 26 / 12;
    else if (cadence >= 26 && cadence <= 35) monthlyFactor = 1;
    if (monthlyFactor === null) continue; // irregular — not a subscription

    const amounts = sorted.map((t) => t.amount ?? 0);
    const typicalAmount = median(amounts);
    if (typicalAmount < 2) continue;
    const consistent =
      amounts.filter((a) => Math.abs(a - typicalAmount) <= Math.max(2, typicalAmount * 0.3)).length /
      amounts.length;
    if (consistent < 0.7) continue; // amounts vary too much (groceries, gas...)

    const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'merchant';
    const latest = sorted[sorted.length - 1];
    detected.push({
      id: `plaid-recurring-${itemId}-${slug}`,
      name: latest.merchant_name || latest.name || 'Recurring payment',
      amount: Math.round(typicalAmount * monthlyFactor * 100) / 100,
      plaidItemId: itemId,
      institutionName,
    });
  }
  return detected;
}


// ---------------------------------------------------------------------------
// Debt payment detection
// ---------------------------------------------------------------------------

export interface MappedPayment {
  id: string;
  loanId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payee: string;
  plaidItemId: string;
}

export interface MappedPaymentCandidate {
  id: string;
  date: string;
  amount: number;
  payee: string;
  plaidItemId: string;
}

const DETAILED_TO_LOAN_TYPE: Record<string, MappedLoan['type']> = {
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: 'Credit Card',
  LOAN_PAYMENTS_CAR_PAYMENT: 'Auto',
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'Mortgage',
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: 'Student',
};

const tokens = (text: string | null | undefined): Set<string> =>
  new Set(
    (text ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !['payment', 'online', 'autopay', 'the', 'bank', 'card', 'loan'].includes(t))
  );

const daysApart = (a: string, b: string): number =>
  Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;

/**
 * Matches settled transactions from the last `windowDays` to debts.
 *
 * 1. A credit on a loan's own account (Plaid amount < 0) is a payment to that
 *    loan: exact, no guessing.
 * 2. An outflow categorised LOAN_PAYMENTS from a bank account is matched to a
 *    loan by category -> loan type, payee-name overlap with the loan/institution
 *    and closeness to the expected payment. If only one loan fits the category it
 *    wins outright. Outflows that duplicate a pass-1 payment (same amount within
 *    4 days) are dropped so a payment is never counted twice.
 * 3. Anything left over that looks like a loan payment but matched nothing is
 *    returned as a candidate so the user can answer "Is this a debt payment?".
 */
export function detectDebtPayments(
  transactions: Transaction[],
  loans: MappedLoan[],
  now: Date = new Date(),
  windowDays = 90
): { payments: MappedPayment[]; candidates: MappedPaymentCandidate[] } {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  const loanByAccount = new Map(
    loans.filter((l) => l.plaidAccountId).map((l) => [l.plaidAccountId as string, l])
  );
  const payments: MappedPayment[] = [];
  const candidates: MappedPaymentCandidate[] = [];

  const recent = transactions
    .filter((t) => !t.pending && Date.parse(t.date) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const txn of recent) {
    const loan = loanByAccount.get(txn.account_id);
    if (loan && (txn.amount ?? 0) < 0) {
      payments.push({
        id: `plaid-txn-${txn.transaction_id}`,
        loanId: loan.id,
        amount: Math.round(Math.abs(txn.amount) * 100) / 100,
        date: txn.date,
        payee: txn.merchant_name ?? txn.name ?? loan.name,
        plaidItemId: loan.plaidItemId,
      });
    }
  }
  const accountSide = payments.slice();

  for (const txn of recent) {
    const amount = txn.amount ?? 0;
    if (amount <= 0 || loanByAccount.has(txn.account_id)) continue;
    const category = txn.personal_finance_category;
    if (category?.primary !== 'LOAN_PAYMENTS') continue;

    if (accountSide.some((p) => Math.abs(p.amount - amount) < 0.01 && daysApart(p.date, txn.date) <= 4)) {
      continue; // already captured from the loan account's side
    }

    const payee = txn.merchant_name ?? txn.name ?? 'Payment';
    const wantType = DETAILED_TO_LOAN_TYPE[category.detailed ?? ''];
    const pool = wantType ? loans.filter((l) => l.type === wantType) : loans;
    const payeeTokens = new Set([...tokens(txn.name), ...tokens(txn.merchant_name)]);

    let best: MappedLoan | undefined;
    let bestScore = 0;
    for (const loan of pool) {
      let score = wantType ? 1 : 0;
      const loanTokens = new Set([...tokens(loan.name), ...tokens(loan.institutionName)]);
      if ([...payeeTokens].some((t) => loanTokens.has(t))) score += 2;
      const expected = loan.minPaymentOverride;
      if (expected && amount >= expected * 0.95) score += 1;
      if (score > bestScore) {
        best = loan;
        bestScore = score;
      }
    }
    if (best && (bestScore >= 2 || pool.length === 1)) {
      payments.push({
        id: `plaid-txn-${txn.transaction_id}`,
        loanId: best.id,
        amount: Math.round(amount * 100) / 100,
        date: txn.date,
        payee,
        plaidItemId: best.plaidItemId,
      });
    } else {
      candidates.push({
        id: `plaid-txn-${txn.transaction_id}`,
        date: txn.date,
        amount: Math.round(amount * 100) / 100,
        payee,
        plaidItemId: txn.account_id,
      });
    }
  }

  return { payments, candidates };
}
