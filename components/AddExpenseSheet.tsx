import React, { useEffect, useState } from 'react';
import { EXPENSE_CATEGORIES } from '../constants';
import { Expense } from '../types';
import { toNumber } from '../lib/format';
import { Button, Chip, Field, Inline, Sheet, Stack, Text } from './ui';

export const OTHER_CATEGORY = 'Other';
export const CATEGORY_LABELS = [...EXPENSE_CATEGORIES.map(c => c.label), OTHER_CATEGORY];

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: (expense: Expense) => void;
    /** Existing expense to edit; omit to add. */
    expense?: Expense;
}

/** Add or edit one monthly expense: pick a category, then name and amount (suggestions fill the name). */
const AddExpenseSheet: React.FC<Props> = ({ open, onClose, onSave, expense }) => {
    const [category, setCategory] = useState(OTHER_CATEGORY);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        if (!open) return;
        setCategory(expense?.category ?? OTHER_CATEGORY);
        setName(expense?.name ?? '');
        setAmount(expense ? String(expense.amount) : '');
    }, [open, expense?.id]);

    const suggestions = EXPENSE_CATEGORIES.find(c => c.label === category)?.subcategories ?? [];
    const valid = name.trim().length > 0 && toNumber(amount) > 0;

    const save = () => {
        onSave({ ...(expense ?? {}), id: expense?.id ?? `exp-${Date.now()}`, name: name.trim(), amount: toNumber(amount), category } as Expense);
        onClose();
    };

    return (
        <Sheet open={open} onClose={onClose} title={expense ? 'Edit expense' : 'Add an expense'}>
            <Stack gap="sm">
                <Text variant="label" color="textMuted">Category</Text>
                <Inline wrap gap="sm">{CATEGORY_LABELS.map(c => <Chip key={c} active={category === c} onPress={() => setCategory(c)}>{c}</Chip>)}</Inline>
            </Stack>
            {suggestions.length > 0 ? (
                <Stack gap="sm">
                    <Text variant="label" color="textMuted">Common in this category</Text>
                    <Inline wrap gap="sm">{suggestions.map(s => <Chip key={s.name} active={name === s.name} onPress={() => setName(s.name)}>{s.name}</Chip>)}</Inline>
                </Stack>
            ) : null}
            <Inline><Field label="Name" value={name} onChange={setName} placeholder="e.g. Rent, Gym, Pet insurance" /></Inline>
            <Inline><Field label="Amount per month" prefix="$" numeric value={amount} onChange={setAmount} placeholder="0" hint="Enter a monthly amount. Divide yearly bills by 12." /></Inline>
            <Text variant="caption" color="textMuted">Loan payments (mortgage, auto, student, cards) belong in Debts, not here.</Text>
            <Button size="lg" disabled={!valid} onPress={save}>{expense ? 'Save changes' : 'Add expense'}</Button>
        </Sheet>
    );
};

export default AddExpenseSheet;
