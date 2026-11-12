import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFinance } from '../contexts/FinanceContext';
import { DebtStatus, Loan } from '../types';
import { getEffectiveMinPayment } from '../services/loanCalculator';
import { money } from '../lib/format';
import { Badge, Button, Card, Chip, Grid, Icon, Inline, PageTitle, ProgressBar, Screen, Stack, Text } from '../components/ui';
import DebtSheet from '../components/DebtSheet';
import PlaidLinkButton from '../components/PlaidLinkButton';

const FILTERS: { value: DebtStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'considering', label: 'Considering' },
    { value: 'paid_off', label: 'Paid off' },
];
const EMPTY: Record<DebtStatus, string> = {
    active: 'No active debts yet. Add one to build your plan.',
    considering: 'Nothing here. Use “Test a new loan” and add it as a what-if.',
    paid_off: 'No paid-off debts yet. They will show up here.',
};

const statusOf = (l: Loan): DebtStatus => l.status ?? (l.balance <= 0.005 ? 'paid_off' : 'active');

const DebtsScreen: React.FC = () => {
    const router = useRouter();
    const { add } = useLocalSearchParams<{ add?: string }>();
    const { finances, setFinances } = useFinance();
    const [filter, setFilter] = useState<DebtStatus>('active');
    const [editing, setEditing] = useState<Loan | undefined>();
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => { if (add) { setEditing(undefined); setSheetOpen(true); router.setParams({ add: undefined }); } }, [add]);

    const counts = useMemo(() => {
        const c: Record<DebtStatus, number> = { active: 0, considering: 0, paid_off: 0 };
        finances.loans.forEach(l => c[statusOf(l)]++);
        return c;
    }, [finances.loans]);
    const shown = finances.loans.filter(l => statusOf(l) === filter);

    const save = (loan: Loan) => setFinances(prev => ({
        ...prev,
        loans: prev.loans.some(l => l.id === loan.id) ? prev.loans.map(l => (l.id === loan.id ? loan : l)) : [...prev.loans, loan],
    }));
    const remove = (id: string) => setFinances(prev => ({ ...prev, loans: prev.loans.filter(l => l.id !== id) }));
    const open = (loan?: Loan) => { setEditing(loan); setSheetOpen(true); };

    return (
        <Screen>
            <PageTitle>Debts</PageTitle>
            <Inline gap="md" align="stretch">
                <Stack style={{ flex: 1 }}><Button onPress={() => open()}>+ Add a debt</Button></Stack>
                <Stack style={{ flex: 1 }}><PlaidLinkButton variant="secondary" size="md">Import from bank</PlaidLinkButton></Stack>
            </Inline>

            <Inline wrap gap="sm">
                {FILTERS.map(f => <Chip key={f.value} active={filter === f.value} onPress={() => setFilter(f.value)}>{counts[f.value] ? `${f.label} · ${counts[f.value]}` : f.label}</Chip>)}
            </Inline>

            {shown.length === 0 ? <Card><Text color="textMuted" align="center">{EMPTY[filter]}</Text></Card> : (
                <Grid min={340}>
                    {shown.map(loan => {
                        const start = Math.max(loan.originalAmount, loan.balance);
                        const paid = start > 0 ? Math.max(0, start - loan.balance) / start : 0;
                        return (
                            <Card key={loan.id} onPress={() => open(loan)} gap="sm">
                                <Inline justify="space-between">
                                    <Text variant="h3" style={{ flexShrink: 1 }}>{loan.name}</Text>
                                    {loan.plaidItemId ? <Badge>From bank</Badge> : statusOf(loan) === 'considering' ? <Badge tone="amber">What-if</Badge> : null}
                                </Inline>
                                <Inline justify="space-between" align="baseline">
                                    <Text variant="stat">{money(loan.balance)}</Text>
                                    <Text variant="smallStrong" color="amber">{loan.apr ? `${loan.apr.toFixed(1)}% APR` : 'APR needed'}</Text>
                                </Inline>
                                <ProgressBar value={paid} label={`${loan.name} paid`} />
                                <Inline justify="space-between"><Text variant="label" color="textMuted">{Math.round(paid * 100)}% paid</Text><Text variant="label" color="textMuted">Min. {money(getEffectiveMinPayment(loan))}/mo</Text></Inline>
                            </Card>
                        );
                    })}
                </Grid>
            )}

            <Card tone="outline" onPress={() => router.push('/debts/test')}>
                <Inline justify="space-between">
                    <Stack gap="xs"><Text variant="bodyStrong">Test a new loan</Text><Text variant="label" color="textMuted">See the impact before you borrow</Text></Stack>
                    <Icon name="chevron" size={20} color="textMuted" />
                </Inline>
            </Card>

            <DebtSheet open={sheetOpen} onClose={() => setSheetOpen(false)} loan={editing} onSave={save} onDelete={remove} />
        </Screen>
    );
};

export default DebtsScreen;
