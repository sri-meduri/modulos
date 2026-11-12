import React, { useEffect, useState } from 'react';
import { Loan, LoanType, DebtStatus } from '../types';
import { LOAN_PRESETS } from '../constants';
import { calculateMinimumPayment } from '../services/loanCalculator';
import { Button, Chip, Field, Sheet, money } from './ui';

const TYPES: { type: LoanType; label: string }[] = [
    { type: LoanType.CreditCard, label: 'Credit card' },
    { type: LoanType.Auto, label: 'Auto loan' },
    { type: LoanType.Student, label: 'Student loan' },
    { type: LoanType.Mortgage, label: 'Mortgage' },
    { type: LoanType.Other, label: 'Other' },
];

interface Draft {
    name: string; type: LoanType; balance: string; apr: string; minPayment: string; termYears: string;
    dueDay: string; propertyTax: string;
}

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

/** Add / edit a debt. Type chips prefill typical APR and term. */
const DebtSheet: React.FC<Props> = ({ open, onClose, loan, onSave, onDelete }) => {
    const [d, setD] = useState<Draft>(() => toDraft(loan));
    const [more, setMore] = useState(false);
    const [touchedApr, setTouchedApr] = useState(false);
    useEffect(() => { if (open) { setD(toDraft(loan)); setMore(false); setTouchedApr(false); } }, [open, loan?.id]);

    const set = (k: keyof Draft) => (v: string) => setD(prev => ({ ...prev, [k]: v }));
    const pickType = (type: LoanType) => {
        const p = LOAN_PRESETS[type];
        setD(prev => ({
            ...prev, type,
            apr: touchedApr || loan ? prev.apr : String(p.apr),
            termYears: loan ? prev.termYears : String(p.termYears),
        }));
    };

    const balance = parseFloat(d.balance) || 0;
    const apr = parseFloat(d.apr) || 0;
    const term = parseFloat(d.termYears) || LOAN_PRESETS[d.type].termYears;
    const calcMin = calculateMinimumPayment(loan?.originalAmount || balance, apr, term);
    const valid = balance > 0;

    const save = () => {
        const minPayment = d.minPayment === '' ? undefined : parseFloat(d.minPayment);
        const dueDay = parseInt(d.dueDay, 10);
        const tax = parseFloat(d.propertyTax);
        const next: Loan = {
            ...(loan ?? {}),
            id: loan?.id ?? `debt-${Date.now()}`,
            name: d.name.trim() || LOAN_PRESETS[d.type].name,
            type: d.type, balance, apr, term,
            originalAmount: loan ? (loan.originalAmount > 0 ? loan.originalAmount : balance) : balance,
            minPaymentOverride: minPayment !== undefined && Number.isFinite(minPayment) ? minPayment : undefined,
            dueDay: dueDay >= 1 && dueDay <= 31 ? dueDay : undefined,
            monthlyPropertyTax: d.type === LoanType.Mortgage && tax > 0 ? tax : undefined,
            status: loan?.status ?? 'active',
        };
        // Strip undefined keys so the saved JSON stays clean.
        (Object.keys(next) as (keyof Loan)[]).forEach(k => next[k] === undefined && delete next[k]);
        onSave(next);
        onClose();
    };

    const setStatus = (status: DebtStatus) => {
        if (!loan) return;
        onSave({ ...loan, status });
        onClose();
    };

    return (
        <Sheet open={open} onClose={onClose} title={loan ? 'Edit debt' : 'Add a debt'}>
            <div className="flex flex-col gap-2.5">
                <span className="text-[13px] text-dark-text-secondary">Type of debt</span>
                <div className="flex flex-wrap gap-2">
                    {TYPES.map(t => <Chip key={t.type} active={d.type === t.type} onClick={() => pickType(t.type)}>{t.label}</Chip>)}
                </div>
            </div>
            <Field label="Name (optional)" type="text" inputMode="text" value={d.name} onChange={set('name')} placeholder={LOAN_PRESETS[d.type].name} />
            <Field label="Balance" prefix="$" value={d.balance} onChange={set('balance')} placeholder="0" />
            <div className="flex gap-3">
                <Field className="flex-1" label="APR" suffix="%" value={d.apr} onChange={v => { setTouchedApr(true); set('apr')(v); }} hint={loan ? undefined : LOAN_PRESETS[d.type].hint} />
                <Field className="flex-1" label="Minimum payment" prefix="$" value={d.minPayment} onChange={set('minPayment')}
                    placeholder={calcMin > 0 ? String(Math.round(calcMin)) : '0'} hint={d.minPayment === '' && calcMin > 0 ? `Estimated ${money(calcMin)}/mo` : undefined} />
            </div>
            {d.type === LoanType.CreditCard && d.minPayment === '' && (
                <p className="text-xs text-amber">Cards have no fixed term. Enter the minimum from your statement for accurate results.</p>
            )}
            <button type="button" className="text-sm text-accent font-semibold text-left" onClick={() => setMore(m => !m)} aria-expanded={more}>
                {more ? 'Fewer details' : 'More details (term, due date)'}
            </button>
            {more && (
                <>
                    <div className="flex gap-3">
                        <Field className="flex-1" label="Term (years)" value={d.termYears} onChange={set('termYears')} />
                        <Field className="flex-1" label="Due day of month" value={d.dueDay} onChange={set('dueDay')} placeholder="e.g. 15" inputMode="numeric" />
                    </div>
                    {d.type === LoanType.Mortgage && (
                        <Field label="Monthly property tax" prefix="$" value={d.propertyTax} onChange={set('propertyTax')} hint="Counted as a bill, not a payment on this loan." />
                    )}
                </>
            )}
            <Button size="lg" disabled={!valid} onClick={save}>{loan ? 'Save changes' : 'Add debt'}</Button>
            {loan && (
                <div className="flex flex-col gap-2">
                    {(loan.status ?? 'active') !== 'paid_off' && <Button variant="secondary" onClick={() => setStatus('paid_off')}>Mark as paid off</Button>}
                    {(loan.status ?? 'active') !== 'active' && <Button variant="secondary" onClick={() => setStatus('active')}>Make active</Button>}
                    {(loan.status ?? 'active') === 'active' && <Button variant="secondary" onClick={() => setStatus('considering')}>Move to Considering</Button>}
                    {onDelete && <Button variant="danger" onClick={() => { if (window.confirm('Delete this debt?')) { onDelete(loan.id); onClose(); } }}>Delete</Button>}
                </div>
            )}
        </Sheet>
    );
};

export default DebtSheet;
