import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFinance } from '../contexts/FinanceContext';
import { DebtStatus, Loan } from '../types';
import { getEffectiveMinPayment } from '../services/loanCalculator';
import { Badge, Button, Card, Chip, PageTitle, ProgressBar, money, Icon, ICONS } from '../components/ui';
import DebtSheet from '../components/DebtSheet';
import PlaidLinkButton from '../components/PlaidLinkButton';

const FILTERS: { value: DebtStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'considering', label: 'Considering' },
    { value: 'paid_off', label: 'Paid off' },
];

const statusOf = (l: Loan): DebtStatus => (l.status ?? (l.balance <= 0.005 ? 'paid_off' : 'active'));

const DebtsPage: React.FC = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { finances, setFinances } = useFinance();
    const [filter, setFilter] = useState<DebtStatus>('active');
    const [editing, setEditing] = useState<Loan | undefined>();
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => {
        if (params.get('add')) { setEditing(undefined); setSheetOpen(true); params.delete('add'); setParams(params, { replace: true }); }
    }, [params]);

    const counts = useMemo(() => {
        const c: Record<DebtStatus, number> = { active: 0, considering: 0, paid_off: 0 };
        finances.loans.forEach(l => c[statusOf(l)]++);
        return c;
    }, [finances.loans]);
    const shown = finances.loans.filter(l => statusOf(l) === filter);

    const save = (loan: Loan) =>
        setFinances(prev => ({
            ...prev,
            loans: prev.loans.some(l => l.id === loan.id) ? prev.loans.map(l => (l.id === loan.id ? loan : l)) : [...prev.loans, loan],
        }));
    const remove = (id: string) => setFinances(prev => ({ ...prev, loans: prev.loans.filter(l => l.id !== id) }));

    return (
        <div className="flex flex-col gap-4">
            <PageTitle>Debts</PageTitle>
            <div className="flex gap-2.5">
                <Button className="flex-1" onClick={() => { setEditing(undefined); setSheetOpen(true); }}>+ Add a debt</Button>
                <div className="flex-1"><PlaidLinkButton variant="secondary" size="md" className="[&_button]:px-2 [&_button]:whitespace-nowrap">Import from bank</PlaidLinkButton></div>
            </div>

            <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by status">
                {FILTERS.map(f => <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}{counts[f.value] ? ` · ${counts[f.value]}` : ''}</Chip>)}
            </div>

            {shown.length === 0 && (
                <Card className="text-center text-[15px] text-dark-text-secondary py-8">
                    {filter === 'active' ? 'No active debts yet. Add one to build your plan.' : filter === 'considering' ? 'Nothing here. Use “Test a new loan” and add it as a what-if.' : 'No paid-off debts yet. They will show up here.'}
                </Card>
            )}

            {shown.map(loan => {
                const start = Math.max(loan.originalAmount, loan.balance);
                const paid = start > 0 ? Math.max(0, start - loan.balance) / start : 0;
                return (
                    <button key={loan.id} onClick={() => { setEditing(loan); setSheetOpen(true); }} className="text-left">
                        <Card className="flex flex-col gap-2.5 p-3.5 hover:border-line transition-colors">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-base font-semibold">{loan.name}</span>
                                {loan.plaidItemId ? <Badge>From bank</Badge> : statusOf(loan) === 'considering' ? <Badge tone="amber">What-if</Badge> : null}
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-[22px] font-bold tnum">{money(loan.balance)}</span>
                                <span className="text-[13px] font-semibold text-amber">{loan.apr ? `${loan.apr.toFixed(1)}% APR` : 'APR needed'}</span>
                            </div>
                            <ProgressBar value={paid} label={`${loan.name} paid`} />
                            <div className="flex justify-between text-[13px] text-dark-text-secondary">
                                <span>{Math.round(paid * 100)}% paid</span>
                                <span>Min. {money(getEffectiveMinPayment(loan))}/mo</span>
                            </div>
                        </Card>
                    </button>
                );
            })}

            <Link to="/debts/test">
                <Card tone="outline" className="flex items-center justify-between py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold">Test a new loan</span>
                        <span className="text-[13px] text-dark-text-secondary">See the impact before you borrow</span>
                    </div>
                    <Icon d={ICONS.chevron} className="w-5 h-5 text-dark-text-secondary" />
                </Card>
            </Link>

            <DebtSheet open={sheetOpen} onClose={() => setSheetOpen(false)} loan={editing} onSave={save} onDelete={remove} />
        </div>
    );
};

export default DebtsPage;
