import { mergeDetectedPayments } from './payments';
import { Finances, Loan, Expense, Asset, Payment, PaymentCandidate, MonthlyFinanceSnapshot } from '../types';

export interface PlaidImport {
    loans: Loan[];
    expenses: Expense[];
    assets: Asset[];
    payments: Payment[];
    paymentCandidates: PaymentCandidate[];
    attentionItemIds: string[];
    incomeExpenseHistory: MonthlyFinanceSnapshot[];
}

/**
 * Merges Plaid-imported loans/expenses into the current Finances blob.
 *
 * Merge policy (deliberate — preserves user edits across re-syncs):
 * - Existing imported loan (same plaid- id): always refresh `balance`
 *   (and `originalAmount` when it still tracked the old balance);
 *   refresh `apr`/`minPaymentOverride` only when Plaid supplied a real
 *   value, so a user-corrected APR on an Auto/Other loan is never
 *   clobbered by Plaid's unknown-0. Never touches user-editable
 *   `name`, `type`, `term`, `monthlyPropertyTax`.
 * - Existing imported expense (same plaid-recurring- id): refresh
 *   `amount` only, keep any user-edited name.
 * - Existing imported asset (same plaid-asset- id): refresh `value` only,
 *   keep any user-edited name/type.
 * - New ids are appended. Accounts/streams that vanished from Plaid are
 *   left in place (manual cleanup in v1).
 */
export function mergePlaidData(current: Finances, imported: PlaidImport): Finances {
    const importedLoansById = new Map(imported.loans.map(l => [l.id, l]));
    const importedExpensesById = new Map(imported.expenses.map(e => [e.id, e]));

    const mergedLoans: Loan[] = current.loans.map(loan => {
        const update = importedLoansById.get(loan.id);
        if (!update) return loan;
        importedLoansById.delete(loan.id);
        const next: Loan = {
            ...loan,
            balance: update.balance,
            originalAmount: loan.originalAmount === loan.balance ? update.balance : loan.originalAmount,
            plaidItemId: update.plaidItemId,
            institutionName: update.institutionName ?? loan.institutionName,
            plaidAccountId: update.plaidAccountId ?? loan.plaidAccountId,
            dueDay: update.dueDay ?? loan.dueDay,
        };
        // A balance that reaches zero at the bank means the debt is paid off.
        if (update.balance <= 0.005 && next.status !== 'considering') next.status = 'paid_off';
        if (update.apr > 0) next.apr = update.apr;
        if (update.minPaymentOverride !== undefined && update.minPaymentOverride > 0) {
            next.minPaymentOverride = update.minPaymentOverride;
        }
        return next;
    });
    mergedLoans.push(...importedLoansById.values());

    const mergedExpenses: Expense[] = current.expenses.map(expense => {
        const update = importedExpensesById.get(expense.id);
        if (!update) return expense;
        importedExpensesById.delete(expense.id);
        return {
            ...expense,
            amount: update.amount,
            plaidItemId: update.plaidItemId,
            institutionName: update.institutionName ?? expense.institutionName,
        };
    });
    mergedExpenses.push(...importedExpensesById.values());

    const importedAssetsById = new Map(imported.assets.map(a => [a.id, a]));
    const mergedAssets: Asset[] = (current.assets ?? []).map(asset => {
        const update = importedAssetsById.get(asset.id);
        if (!update) return asset;
        importedAssetsById.delete(asset.id);
        return {
            ...asset,
            value: update.value,
            plaidItemId: update.plaidItemId,
            institutionName: update.institutionName ?? asset.institutionName,
        };
    });
    mergedAssets.push(...importedAssetsById.values());

    // Plaid's transaction-derived history is authoritative for the 12 months it
    // covers, so replace wholesale when present; otherwise keep what we have
    // (e.g. transactions weren't ready yet, or a manual-only user's snapshots).
    const incomeExpenseHistory =
        imported.incomeExpenseHistory.length > 0
            ? imported.incomeExpenseHistory
            : current.incomeExpenseHistory;

    return { ...current, loans: mergedLoans, expenses: mergedExpenses, assets: mergedAssets, incomeExpenseHistory };
}

/**
 * Removes the Plaid link (badge/association) from loans and expenses of a
 * disconnected bank, keeping the data itself (keep-but-unlink policy).
 */
export function unlinkPlaidItem(current: Finances, itemId: string): Finances {
    const stripLoan = (loan: Loan): Loan => {
        if (loan.plaidItemId !== itemId) return loan;
        const { plaidItemId, institutionName, ...rest } = loan;
        return rest;
    };
    const stripExpense = (expense: Expense): Expense => {
        if (expense.plaidItemId !== itemId) return expense;
        const { plaidItemId, institutionName, ...rest } = expense;
        return rest;
    };
    const stripAsset = (asset: Asset): Asset => {
        if (asset.plaidItemId !== itemId) return asset;
        const { plaidItemId, institutionName, ...rest } = asset;
        return rest;
    };
    return {
        ...current,
        loans: current.loans.map(stripLoan),
        expenses: current.expenses.map(stripExpense),
        assets: (current.assets ?? []).map(stripAsset),
    };
}

/**
 * Parses the JSON payloads returned by the syncPlaidData mutation.
 * AWSJSON values can arrive as arrays or as (possibly double-)encoded
 * JSON strings depending on how many serialization layers applied —
 * unwrap string layers until we hit a non-string.
 */
export function parseSyncResult(result: { loans?: unknown; expenses?: unknown; assets?: unknown; payments?: unknown; paymentCandidates?: unknown; attentionItemIds?: unknown; incomeExpenseHistory?: unknown } | null | undefined): PlaidImport {
    const parse = <T,>(value: unknown): T[] => {
        let v = value;
        for (let depth = 0; depth < 3 && typeof v === 'string'; depth++) {
            try {
                v = JSON.parse(v);
            } catch {
                return [];
            }
        }
        return Array.isArray(v) ? v : [];
    };
    return {
        loans: parse<Loan>(result?.loans),
        expenses: parse<Expense>(result?.expenses),
        assets: parse<Asset>(result?.assets),
        payments: parse<Payment>(result?.payments),
        paymentCandidates: parse<PaymentCandidate>(result?.paymentCandidates),
        attentionItemIds: Array.isArray(result?.attentionItemIds) ? (result?.attentionItemIds as string[]) : [],
        incomeExpenseHistory: parse<MonthlyFinanceSnapshot>(result?.incomeExpenseHistory),
    };
}


/**
 * One call for a bank sync result: refreshes loans/expenses/assets, then adds
 * detected debt payments. Detected payments never alter balances (the sync
 * above already did).
 */
export function applySyncResult(current: Finances, imported: PlaidImport): Finances {
    return mergeDetectedPayments(mergePlaidData(current, imported), imported.payments);
}

/**
 * "Disconnect and delete imported data": removes everything that came from a
 * bank. Debts imported from the bank are deleted outright; user history
 * (logged/detected payments, balance history) stays in Modulos.
 */
export function deleteImportedData(current: Finances, itemId: string): Finances {
    const droppedLoanIds = new Set(current.loans.filter(l => l.plaidItemId === itemId).map(l => l.id));
    return {
        ...current,
        loans: current.loans.filter(l => l.plaidItemId !== itemId),
        expenses: current.expenses.filter(e => e.plaidItemId !== itemId),
        assets: (current.assets ?? []).filter(a => a.plaidItemId !== itemId),
        // Keep the history of payments but detach nothing: payments for removed
        // debts remain visible by payee name in Progress.
        payments: (current.payments ?? []).map(p =>
            droppedLoanIds.has(p.loanId) ? { ...p, payee: p.payee ?? 'Removed debt' } : p
        ),
    };
}
