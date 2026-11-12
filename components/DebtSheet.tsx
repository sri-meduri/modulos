import React, { useEffect, useState } from 'react';
import { Loan, LoanType, DebtStatus } from '../types';
import { LOAN_PRESETS } from '../constants';
import { calculateMinimumPayment } from '../services/loanCalculator';
import { confirmAction } from '../lib/dialog';
import { money, toNumber } from '../lib/format';
import { Button, Chip, Field, Inline, Sheet, Stack, Text, TextButton } from './ui';

const TYPES: { type: LoanType; label: string }[] = [
    { type: LoanType.CreditCard, label: 'Credit card' },
    { type: LoanType.Auto, label: 'Auto loan' },
    { type: LoanType.Student, label: 'Student loan' },
    { type: LoanType.Mortgage, label: 'Mortgage' },
    { type: LoanType.Other, label: 'Other' },
];

interface Draft { name: string; type: LoanType; balance: string; apr: string; minPayment: string; termYears: string; dueDay: string; propertyTax: string }

const toDraft = (loan?: Loan, type: LoanType = LoanType.CreditCard): Draft => {
    if (loan) {
        return {
            name: loan.name, type: loan.type, balance: String(loan.balance), apr: String(loan.apr),
            minPayment: loan.minPaymentOverride !== undefined ? String(loan.minPaymentOverride) : '',
            termYears: String(loan.term), dueDay: loan.dueDay ? String(loan.dueDay) : '',
            propertyTax: loan.monthlyPropertyTax ? String(loan.monthlyPropertyTax) : '',
        };
    }
    const p = LOAN_PRESETS[type];
    return { name: '', type, balance: '', apr: String(p.apr), minPayment: '', termYears: String(p.termYears), dueDay: '', propertyTax: '' };
};

interface Props {
    open: boolean;
    onClose: () => void;
    /** Existing debt to edit; omit to add. */
    loan?: Loan;
    onSave: (loan: Loan) => void;
    onDelete?: (id: string) => void;
}

/** Add / edit a debt. Type chips prefill a typical APR and term. */
const DebtSheet: React.FC<Props> = ({ open, onClose, loan, onSave, onDelete }) => {
    const [d, setD] = useState<Draft>(() => toDraft(loan));
    const [more, setMore] = useState(false);
    const [touchedApr, setTouchedApr] = useState(false);
    useEffect(() => { if (open) { setD(toDraft(loan)); setMore(false); setTouchedApr(false); } }, [open, loan?.id]);

    const set = (k: keyof Draft) => (v: string) => setD(prev => ({ ...prev, [k]: v }));
    const pickType = (type: LoanType) => {
        const p = LOAN_PRESETS[type];
        setD(prev => ({ ...prev, type, apr: touchedApr || loan ? prev.apr : String(p.apr), termYears: loan ? prev.termYears : String(p.termYears) }));
    };

    const balance = toNumber(d.balance);
    const apr = toNumber(d.apr);
    const term = toNumber(d.termYears) || LOAN_PRESETS[d.type].termYears;
    const calcMin = calculateMinimumPayment(loan?.originalAmount || balance, apr, term);

    const save = () => {
        const minPayment = d.minPayment === '' ? undefined : toNumber(d.minPayment);
        const dueDay = parseInt(d.dueDay, 10);
        const tax = toNumber(d.propertyTax);
        const next: Loan = {
            ...(loan ?? {}),
            id: loan?.id ?? `debt-${Date.now()}`,
            name: d.name.trim() || LOAN_PRESETS[d.type].name,
            type: d.type, balance, apr, term,
            originalAmount: loan ? (loan.originalAmount > 0 ? loan.originalAmount : balance) : balance,
            minPaymentOverride: minPayment,
            dueDay: dueDay >= 1 && dueDay <= 31 ? dueDay : undefined,
            monthlyPropertyTax: d.type === LoanType.Mortgage && tax > 0 ? tax : undefined,
            status: loan?.status ?? 'active',
        };
        // Keep the saved JSON clean: no undefined keys.
        (Object.keys(next) as (keyof Loan)[]).forEach(k => next[k] === undefined && delete next[k]);
        onSave(next);
        onClose();
    };

    const setStatus = (status: DebtStatus) => { if (loan) { onSave({ ...loan, status }); onClose(); } };
    const status = loan?.status ?? 'active';

    return (
        <Sheet open={open} onClose={onClose} title={loan ? 'Edit debt' : 'Add a debt'}>
            <Stack gap="sm">
                <Text variant="label" color="textMuted">Type of debt</Text>
                <Inline wrap gap="sm">{TYPES.map(t => <Chip key={t.type} active={d.type === t.type} onPress={() => pickType(t.type)}>{t.label}</Chip>)}</Inline>
            </Stack>
            <Inline><Field label="Name (optional)" value={d.name} onChange={set('name')} placeholder={LOAN_PRESETS[d.type].name} /></Inline>
            <Inline><Field label="Balance" prefix="$" numeric value={d.balance} onChange={set('balance')} placeholder="0" /></Inline>
            <Inline align="flex-start">
                <Field label="APR" suffix="%" numeric value={d.apr} onChange={v => { setTouchedApr(true); set('apr')(v); }} hint={loan ? undefined : LOAN_PRESETS[d.type].hint} />
                <Field label="Minimum payment" prefix="$" numeric value={d.minPayment} onChange={set('minPayment')} placeholder={calcMin > 0 ? String(Math.round(calcMin)) : '0'} hint={d.minPayment === '' && calcMin > 0 ? `Estimated ${money(calcMin)}/mo` : undefined} />
            </Inline>
            {d.type === LoanType.Mortgage ? <Inline><Field label="Monthly property tax (optional)" prefix="$" numeric value={d.propertyTax} onChange={set('propertyTax')} hint="Only for homeowners. Counted as a monthly expense, not a payment on this loan." /></Inline> : null}
            {d.type === LoanType.CreditCard && d.minPayment === '' ? <Text variant="caption" color="amber">Cards have no fixed term. Enter the minimum from your statement for accurate results.</Text> : null}
            <TextButton onPress={() => setMore(m => !m)}>{more ? 'Fewer details' : 'More details (term, due date)'}</TextButton>
            {more ? (
                <>
                    <Inline align="flex-start">
                        <Field label="Term (years)" numeric value={d.termYears} onChange={set('termYears')} />
                        <Field label="Due day of month" keyboardType="number-pad" value={d.dueDay} onChange={set('dueDay')} placeholder="e.g. 15" />
                    </Inline>
                </>
            ) : null}
            <Button size="lg" disabled={balance <= 0} onPress={save}>{loan ? 'Save changes' : 'Add debt'}</Button>
            {loan ? (
                <Stack gap="sm">
                    {status !== 'paid_off' ? <Button variant="secondary" onPress={() => setStatus('paid_off')}>Mark as paid off</Button> : null}
                    {status !== 'active' ? <Button variant="secondary" onPress={() => setStatus('active')}>Make active</Button> : null}
                    {status === 'active' ? <Button variant="secondary" onPress={() => setStatus('considering')}>Move to Considering</Button> : null}
                    {onDelete ? <Button variant="danger" onPress={async () => { if (await confirmAction('Delete this debt?', 'This cannot be undone.', 'Delete', true)) { onDelete(loan.id); onClose(); } }}>Delete</Button> : null}
                </Stack>
            ) : null}
        </Sheet>
    );
};

export default DebtSheet;
