import { describe, expect, it } from 'vitest';
import { detectDebtPayments, MappedLoan } from '../amplify/functions/plaid/mapping';
import { mergePlaidData, deleteImportedData } from '../services/plaidSync';
import type { Transaction } from 'plaid';

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const txn = (o: Record<string, unknown>) => ({ pending: false, ...o }) as unknown as Transaction;

const loans: MappedLoan[] = [
    { id: 'plaid-card', name: 'Visa', type: 'Credit Card', balance: 3000, apr: 22, term: 5, originalAmount: 3000, plaidItemId: 'i', plaidAccountId: 'card', minPaymentOverride: 90 },
    { id: 'plaid-auto', name: 'Auto Loan', type: 'Auto', balance: 11000, apr: 7, term: 5, originalAmount: 11000, plaidItemId: 'i', plaidAccountId: 'auto', institutionName: 'Capital' },
];

describe('detectDebtPayments', () => {
    it('matches credits on a loan account, de-duplicates the bank-side outflow, and matches by category', () => {
        const { payments, candidates } = detectDebtPayments([
            txn({ transaction_id: 't1', account_id: 'chk', amount: 650, date: daysAgo(5), name: 'AUTOPAY CAPITAL AUTO', personal_finance_category: { primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CAR_PAYMENT' } }),
            txn({ transaction_id: 't3', account_id: 'card', amount: -90, date: daysAgo(2), name: 'PAYMENT THANK YOU' }),
            txn({ transaction_id: 't3b', account_id: 'chk', amount: 90, date: daysAgo(2), name: 'CARD PAYMENT', personal_finance_category: { primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' } }),
        ], loans);
        expect(payments.map(p => `${p.loanId}:${p.amount}`).sort()).toEqual(['plaid-auto:650', 'plaid-card:90']);
        expect(candidates).toEqual([]);
    });
    it('returns unmatched loan-looking payments as candidates', () => {
        const { payments, candidates } = detectDebtPayments([
            txn({ transaction_id: 't2', account_id: 'chk', amount: 200, date: daysAgo(3), name: 'MYSTERY LENDER', personal_finance_category: { primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_OTHER_PAYMENT' } }),
        ], loans);
        expect(payments).toEqual([]);
        expect(candidates.map(c => c.id)).toEqual(['plaid-txn-t2']);
    });
    it('ignores old and pending transactions', () => {
        const { payments, candidates } = detectDebtPayments([
            txn({ transaction_id: 'old', account_id: 'card', amount: -90, date: daysAgo(200), name: 'x' }),
            txn({ transaction_id: 'pend', account_id: 'card', amount: -90, date: daysAgo(1), name: 'x', pending: true }),
        ], loans);
        expect([...payments, ...candidates]).toEqual([]);
    });
});

describe('bank data lifecycle', () => {
    const base = { incomeType: 'net' as const, monthlyGrossIncome: 0, monthlyNetIncome: 0, filingStatus: 'single' as const, zip: '', monthly401kContribution: 0, annualIraContribution: 0, annualItemizedDeductions: 0 };
    it('keeps a user-edited name on re-sync and marks a zero balance paid off', () => {
        const cur = { ...base, expenses: [], loans: [{ id: 'plaid-card', name: 'My card', type: 'Credit Card', balance: 100, apr: 20, term: 5, originalAmount: 100, plaidItemId: 'i' }] } as never;
        const merged = mergePlaidData(cur, { loans: [{ id: 'plaid-card', name: 'Visa 4417', type: 'Credit Card', balance: 0, apr: 0, term: 5, originalAmount: 0, plaidItemId: 'i' }], expenses: [], assets: [], payments: [], paymentCandidates: [], attentionItemIds: [], incomeExpenseHistory: [] } as never);
        expect(merged.loans[0].name).toBe('My card');
        expect(merged.loans[0].status).toBe('paid_off');
        expect(merged.loans[0].apr).toBe(20);
    });
    it('deleteImportedData removes imported debts, bills and assets but keeps payment history', () => {
        const cur = { ...base, loans: [{ id: 'plaid-a', plaidItemId: 'i' }, { id: 'manual' }], expenses: [{ id: 'e', plaidItemId: 'i', amount: 1 }], assets: [{ id: 'x', plaidItemId: 'i' }], payments: [{ id: 'p', loanId: 'plaid-a' }] } as never;
        const out = deleteImportedData(cur, 'i');
        expect(out.loans.map(l => l.id)).toEqual(['manual']);
        expect(out.expenses).toEqual([]);
        expect(out.assets).toEqual([]);
        expect(out.payments).toHaveLength(1);
    });
});
