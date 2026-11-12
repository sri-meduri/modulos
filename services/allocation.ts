import { EXPENSE_CATEGORIES } from '../constants';
import { Expense } from '../types';

export interface Slice {
    key: string;
    label: string;
    amount: number;
    /** Share of take-home pay (0-1). */
    share: number;
    /** What kind of money this is, so the UI can color it consistently. */
    kind: 'bills' | 'debt' | 'extra' | 'left';
}

const categoryOf = new Map<string, string>();
for (const c of EXPENSE_CATEGORIES) for (const s of c.subcategories) categoryOf.set(s.name, c.label);

/** Groups expenses by category label (unknown / custom / bank bills go under "Other bills"). */
export const groupBills = (expenses: Expense[]): { label: string; amount: number }[] => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
        if (e.amount <= 0) continue;
        const label = categoryOf.get(e.id) ?? categoryOf.get(e.name) ?? 'Other bills';
        totals.set(label, (totals.get(label) ?? 0) + e.amount);
    }
    return [...totals.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
};

/**
 * "Where your money goes": splits monthly take-home pay into bills (by category),
 * debt minimums, the planned extra payment, and what is left. If spending exceeds
 * income the slices are scaled to fit and `overspent` reports the shortfall.
 */
export const allocateIncome = (income: number, expenses: Expense[], debtMinimums: number, extra: number): { slices: Slice[]; overspent: number; available: number } => {
    const bills = groupBills(expenses);
    const billsTotal = bills.reduce((a, b) => a + b.amount, 0);
    const committed = billsTotal + debtMinimums;
    const available = Math.max(0, income - committed);
    const extraPlanned = Math.min(Math.max(0, extra), available);
    const left = Math.max(0, available - extraPlanned);
    const overspent = Math.max(0, committed - income);

    const raw: Omit<Slice, 'share'>[] = [
        ...bills.map(b => ({ key: `bill-${b.label}`, label: b.label, amount: b.amount, kind: 'bills' as const })),
        ...(debtMinimums > 0 ? [{ key: 'debt', label: 'Debt minimums', amount: debtMinimums, kind: 'debt' as const }] : []),
        ...(extraPlanned > 0 ? [{ key: 'extra', label: 'Extra toward debt', amount: extraPlanned, kind: 'extra' as const }] : []),
        ...(left > 0 ? [{ key: 'left', label: 'Left to spend or save', amount: left, kind: 'left' as const }] : []),
    ];
    const total = raw.reduce((a, s) => a + s.amount, 0) || 1;
    return { slices: raw.map(s => ({ ...s, share: s.amount / total })), overspent, available };
};
