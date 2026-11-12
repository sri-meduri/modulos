import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import useAmplifyStorage from '../hooks/useAmplifyStorage';
import { useAuth } from './AuthContext';
import { Finances, Settings, RiskProfile, Expense, LoanType, Loan, PaymentCandidate } from '../types';
import { applySyncResult, PlaidImport } from '../services/plaidSync';
import { candidateToPayment } from '../services/payments';
import { isActiveLoan } from '../services/payoff';
import { getEffectiveMinPayment } from '../services/loanCalculator';
import { STANDARD_EXPENSES } from '../constants';
import { createSampleFinances, createSampleSettings } from '../services/sampleData';
import ImportGuestDataModal from '../components/ImportGuestDataModal';
import { storage } from '../lib/storage';

interface FinanceContextType {
    finances: Finances;
    setFinances: React.Dispatch<React.SetStateAction<Finances>>;
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    monthlyDebtPayments: number;
    totalDebt: number;
    /** Loans that count toward totals and the plan (status 'active', balance > 0). */
    activeLoans: Loan[];
    /** What-if loans from "Test a new loan". */
    consideringLoans: Loan[];
    paidOffLoans: Loan[];
    totalAssets: number;
    netWorth: number;
    monthlyExpensesTotal: number;
    monthlyLeftoverMoney: number;
    debtToIncomeRatio: number;
    loading: boolean;
    deleteAllData: () => Promise<void>;
    /** Bank transactions that look like debt payments but matched no debt. */
    paymentCandidates: PaymentCandidate[];
    /** Merge a bank sync result: loans, bills, assets, detected payments. */
    applyBankSync: (imported: PlaidImport) => void;
    /** Answer "Is this a debt payment?": a loan id, or null for "no". */
    resolveCandidate: (candidateId: string, loanId: string | null) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isGuest, isSample, resetData } = useAuth();

    const initialFinances = useMemo<Finances>(() => {
        if (isSample) return createSampleFinances();
        const initialStandardExpenses: Expense[] = STANDARD_EXPENSES.map(name => ({ id: name, name, amount: 0 }));
        return {
            incomeType: 'net',
            monthlyGrossIncome: 0,
            monthlyNetIncome: 0,
            filingStatus: 'single',
            zip: '',
            expenses: initialStandardExpenses,
            loans: [],
            assets: [],
            monthly401kContribution: 0,
            annualIraContribution: 0,
            annualItemizedDeductions: 0,
            incomeExpenseHistory: [],
        };
    }, [isSample]);

    const initialSettings = useMemo<Settings>(() => (
        isSample ? createSampleSettings() : { riskProfile: RiskProfile.Average, strategy: 'avalanche' as const, extraPayment: 0 }
    ), [isSample]);

    const [finances, setFinances, financesLoading, deleteRemoteFinances] = useAmplifyStorage<Finances>('finances', initialFinances, 'Finances', ['expenses', 'loans', 'assets', 'payments', 'incomeExpenseHistory', 'balanceHistory']);
    const [settings, setSettings, settingsLoading, deleteRemoteSettings] = useAmplifyStorage<Settings>('settings', initialSettings, 'Settings', ['customOrder', 'payeeRules', 'ignoredCandidates']);

    // Guest data is never silently discarded on sign-in: if guest_finances/guest_settings
    // exist in storage once a real user is signed in, always ask before either
    // merging them into the account or clearing them.
    const [importPrompt, setImportPrompt] = useState<{ guestFinances: Finances | null; guestSettings: Settings | null } | null>(null);
    const reconciledUserRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user || isGuest) return;
        if (reconciledUserRef.current === user.userId) return;
        reconciledUserRef.current = user.userId;

        const guestFinancesRaw = storage.getItem('guest_finances');
        const guestSettingsRaw = storage.getItem('guest_settings');
        if (!guestFinancesRaw && !guestSettingsRaw) return;

        setImportPrompt({
            guestFinances: guestFinancesRaw ? JSON.parse(guestFinancesRaw) : null,
            guestSettings: guestSettingsRaw ? JSON.parse(guestSettingsRaw) : null,
        });
    }, [user?.userId, isGuest]);

    const resolveImportPrompt = (choice: 'import' | 'discard') => {
        if (choice === 'import' && importPrompt) {
            if (importPrompt.guestFinances) setFinances(importPrompt.guestFinances);
            if (importPrompt.guestSettings) setSettings(importPrompt.guestSettings);
        }
        storage.removeItem('guest_finances');
        storage.removeItem('guest_settings');
        setImportPrompt(null);
    };

    const [rawCandidates, setRawCandidates] = useState<PaymentCandidate[]>([]);

    const paymentCandidates = useMemo(() => {
        const handled = new Set([...(settings.ignoredCandidates ?? []), ...(finances.payments ?? []).map(p => p.id)]);
        return rawCandidates.filter(c => !handled.has(c.id));
    }, [rawCandidates, settings.ignoredCandidates, finances.payments]);

    const applyBankSync = (imported: PlaidImport) => {
        const rules = settings.payeeRules ?? {};
        // Candidates whose payee the user already classified are applied silently.
        const remembered: PaymentCandidate[] = [];
        const open: PaymentCandidate[] = [];
        for (const c of imported.paymentCandidates) (rules[c.payee] ? remembered : open).push(c);
        setFinances(prev => {
            let next = applySyncResult(prev, imported);
            if (remembered.length) {
                const extra = remembered.flatMap(c => {
                    const loan = next.loans.find(l => l.id === rules[c.payee]);
                    return loan ? [candidateToPayment(c, loan)] : [];
                });
                next = applySyncResult(next, { ...imported, loans: [], expenses: [], assets: [], incomeExpenseHistory: [], payments: extra });
            }
            return next;
        });
        setRawCandidates(open);
    };

    const resolveCandidate = (candidateId: string, loanId: string | null) => {
        const c = rawCandidates.find(x => x.id === candidateId);
        if (!c) return;
        if (loanId === null) {
            setSettings(prev => ({ ...prev, ignoredCandidates: [...(prev.ignoredCandidates ?? []), c.id].slice(-200) }));
            return;
        }
        const loan = finances.loans.find(l => l.id === loanId);
        if (!loan) return;
        setFinances(prev => ({ ...prev, payments: [candidateToPayment(c, loan), ...(prev.payments ?? [])] }));
        // Remember the payee so later matches are automatic.
        setSettings(prev => ({ ...prev, payeeRules: { ...(prev.payeeRules ?? {}), [c.payee]: loanId } }));
    };

    const deleteAllData = async () => {
        if (!isGuest) {
            await Promise.all([deleteRemoteFinances(), deleteRemoteSettings()]);
        }
        storage.clearAppData();
        resetData();
    };

    // Migrate old "Housing (Rent/Mortgage)" and "Rent / Mortgage" to "Rent"
    useEffect(() => {
        const needsMigration = finances.expenses.some(
            exp => exp.id === 'Housing (Rent/Mortgage)' || exp.name === 'Rent / Mortgage'
        );
        if (needsMigration) {
            setFinances(prev => ({
                ...prev,
                expenses: prev.expenses.map(exp =>
                    exp.id === 'Housing (Rent/Mortgage)' || exp.name === 'Rent / Mortgage'
                        ? { ...exp, id: exp.id === 'Housing (Rent/Mortgage)' ? 'Rent' : exp.id, name: 'Rent' }
                        : exp
                )
            }));
        }
    }, []);

    // Sync property tax expenses with mortgage loans
    useEffect(() => {
        let needsUpdate = false;
        const updatedExpenses = [...finances.expenses];

        finances.loans.forEach(loan => {
            const propertyTaxExpenseId = `property-tax-${loan.id}`;
            const existingPropertyTaxExpense = updatedExpenses.find(exp => exp.id === propertyTaxExpenseId);

            if (loan.type === LoanType.Mortgage && loan.monthlyPropertyTax && loan.monthlyPropertyTax > 0 && (loan.status ?? 'active') === 'active') {
                if (existingPropertyTaxExpense) {
                    // Update amount if it changed
                    if (existingPropertyTaxExpense.amount !== loan.monthlyPropertyTax) {
                        const index = updatedExpenses.findIndex(exp => exp.id === propertyTaxExpenseId);
                        updatedExpenses[index] = { ...existingPropertyTaxExpense, amount: loan.monthlyPropertyTax };
                        needsUpdate = true;
                    }
                } else {
                    // Add property tax expense
                    updatedExpenses.push({
                        id: propertyTaxExpenseId,
                        name: 'Property Tax',
                        amount: loan.monthlyPropertyTax
                    });
                    needsUpdate = true;
                }
            } else if (existingPropertyTaxExpense) {
                // Remove property tax expense if loan is no longer mortgage or property tax is 0
                const index = updatedExpenses.findIndex(exp => exp.id === propertyTaxExpenseId);
                updatedExpenses.splice(index, 1);
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            setFinances(prev => ({ ...prev, expenses: updatedExpenses }));
        }
    }, [finances.loans]);

    const { activeLoans, consideringLoans, paidOffLoans, monthlyDebtPayments, totalDebt, totalAssets, netWorth, monthlyExpensesTotal, monthlyLeftoverMoney, debtToIncomeRatio } = useMemo(() => {
        const activeLoans = finances.loans.filter(isActiveLoan);
        const totalDebt = activeLoans.reduce((acc, loan) => acc + loan.balance, 0);
        
        const totalAssets = (finances.assets ?? []).reduce((acc, asset) => acc + asset.value, 0);

        const monthlyDebtPayments = activeLoans.reduce((acc, loan) => acc + getEffectiveMinPayment(loan), 0);
        
        const monthlyExpensesTotal = finances.expenses.reduce((acc, expense) => acc + expense.amount, 0);
        
        const monthlyLeftoverMoney = finances.monthlyNetIncome - monthlyExpensesTotal - monthlyDebtPayments;

        const incomeForDti = finances.monthlyGrossIncome > 0 ? finances.monthlyGrossIncome : finances.monthlyNetIncome;
        const debtToIncomeRatio = incomeForDti > 0 
            ? (monthlyDebtPayments / incomeForDti) 
            : 0;

        return {
            activeLoans,
            consideringLoans: finances.loans.filter(l => l.status === 'considering'),
            paidOffLoans: finances.loans.filter(l => l.status === 'paid_off' || (l.status === undefined && l.balance <= 0.005)),
            monthlyDebtPayments,
            totalDebt,
            totalAssets,
            netWorth: totalAssets - totalDebt,
            monthlyExpensesTotal,
            monthlyLeftoverMoney,
            debtToIncomeRatio,
        };
    }, [finances]);

    const loading = financesLoading || settingsLoading;

    // Record a rolling 12-month history of take-home pay vs. bills; the current month is
    // upserted as the totals change, so the Budget history chart fills in over time.
    useEffect(() => {
        if (loading) return;
        const income = finances.monthlyNetIncome;
        const expenses = monthlyExpensesTotal;
        if (income === 0 && expenses === 0) return; // don't record a pristine month
        const monthKey = new Date().toISOString().slice(0, 7);
        setFinances(prev => {
            const history = prev.incomeExpenseHistory ?? [];
            const existing = history.find(h => h.month === monthKey);
            if (existing && existing.income === income && existing.expenses === expenses) return prev;
            return { ...prev, incomeExpenseHistory: [...history.filter(h => h.month !== monthKey), { month: monthKey, income, expenses }].sort((a, b) => a.month.localeCompare(b.month)).slice(-12) };
        });
    }, [finances.monthlyNetIncome, monthlyExpensesTotal, loading, setFinances]);

    // Record total active debt per month so the Overview/Progress charts show
    // real history (the current month is upserted as balances change).
    useEffect(() => {
        if (loading) return;
        const balance = Math.round(totalDebt * 100) / 100;
        if (balance === 0 && !(finances.balanceHistory ?? []).length) return;
        const monthKey = new Date().toISOString().slice(0, 7);
        setFinances(prev => {
            const history = prev.balanceHistory ?? [];
            const existing = history.find(h => h.month === monthKey);
            if (existing && existing.balance === balance) return prev;
            return {
                ...prev,
                balanceHistory: [...history.filter(h => h.month !== monthKey), { month: monthKey, balance }]
                    .sort((a, b) => a.month.localeCompare(b.month))
                    .slice(-24),
            };
        });
    }, [totalDebt, loading, setFinances]);

    const value = {
        finances,
        setFinances,
        settings,
        setSettings,
        monthlyDebtPayments,
        totalDebt,
        activeLoans,
        consideringLoans,
        paidOffLoans,
        totalAssets,
        netWorth,
        monthlyExpensesTotal,
        monthlyLeftoverMoney,
        debtToIncomeRatio,
        loading,
        deleteAllData,
        paymentCandidates,
        applyBankSync,
        resolveCandidate,
    };

    return (
        <FinanceContext.Provider value={value}>
            {children}
            {importPrompt && (
                <ImportGuestDataModal
                    onImport={() => resolveImportPrompt('import')}
                    onDiscard={() => resolveImportPrompt('discard')}
                />
            )}
        </FinanceContext.Provider>
    );
};

export const useFinance = (): FinanceContextType => {
    const context = useContext(FinanceContext);
    if (!context) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
};