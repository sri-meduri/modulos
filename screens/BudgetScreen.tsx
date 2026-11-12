import React, { useMemo, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useBanks } from '../hooks/useBanks';
import { useAuth } from '../contexts/AuthContext';
import { EXPENSE_CATEGORIES } from '../constants';
import { allocateIncome } from '../services/allocation';
import { colors } from '../theme';
import { Asset, AssetType, Expense } from '../types';
import { money, toNumber } from '../lib/format';
import { BarChart, Badge, Button, Card, Dot, Field, Grid, Icon, Inline, Legend, PageTitle, Screen, Section, Select, Stack, StackedBar, Text, TextButton } from '../components/ui';
import IncomeCard from '../components/IncomeCard';
import PlaidLinkButton from '../components/PlaidLinkButton';
import { Pressable } from 'react-native';

const FIXED_ID = 'fixed-total';
const CATEGORY_NAMES = new Set(EXPENSE_CATEGORIES.flatMap(c => c.subcategories.map(s => s.name)));
const ASSET_TYPES = Object.values(AssetType).map(t => ({ value: t, label: t }));

const BudgetScreen: React.FC = () => {
    const { isSample } = useAuth();
    const { finances, setFinances, settings, monthlyExpensesTotal, monthlyDebtPayments, monthlyLeftoverMoney } = useFinance();
    const { banks, loaded } = useBanks();
    const [openCat, setOpenCat] = useState<string | null>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);

    const expenses = finances.expenses;
    const amountOf = (id: string) => expenses.find(e => e.id === id)?.amount ?? 0;
    const setExpense = (id: string, name: string, amount: number) =>
        setFinances(prev => ({
            ...prev,
            expenses: prev.expenses.some(e => e.id === id)
                ? prev.expenses.map(e => (e.id === id ? { ...e, amount } : e))
                : [...prev.expenses, { id, name, amount }],
        }));
    const removeExpense = (id: string) => setFinances(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));

    const otherBills: Expense[] = expenses.filter(e => e.id !== FIXED_ID && !(CATEGORY_NAMES.has(e.id) && !e.plaidItemId) && e.amount !== 0);
    const breakdownTotal = expenses.filter(e => CATEGORY_NAMES.has(e.id) && !e.plaidItemId).reduce((a, e) => a + e.amount, 0);

    const money_ = allocateIncome(finances.monthlyNetIncome, expenses, monthlyDebtPayments, settings.extraPayment ?? 0);
    const KIND_COLOR = { debt: colors.series[2], extra: colors.accent, left: colors.accentDeep } as const;
    const billColors = [colors.series[3], colors.series[4], colors.series[5], colors.line, colors.textMuted];
    let billIdx = 0;
    const slices = money_.slices.map(sl => ({ ...sl, color: sl.kind === 'bills' ? billColors[billIdx++ % billColors.length] : KIND_COLOR[sl.kind] }));
    const history = (finances.incomeExpenseHistory ?? []).filter(m => m.income > 0 || m.expenses > 0);

    const assets = finances.assets ?? [];
    const setAsset = (id: string, patch: Partial<Asset>) => setFinances(prev => ({ ...prev, assets: (prev.assets ?? []).map(a => (a.id === id ? { ...a, ...patch } : a)) }));

    return (
        <Screen>
            <PageTitle>Budget</PageTitle>

            <Card gap="xs" pad="roomy">
                <Text variant="label" color="textMuted">Left over each month after bills and minimums</Text>
                <Text variant="hero" color={monthlyLeftoverMoney < 0 ? 'risk' : 'accent'}>{money(monthlyLeftoverMoney)}</Text>
                <Text variant="label" color="textMuted">{money(finances.monthlyNetIncome)} income − {money(monthlyExpensesTotal)} bills − {money(monthlyDebtPayments)} minimums</Text>
            </Card>

            {loaded && !isSample && banks.length === 0 ? (
                <Card tone="mint" gap="md">
                    <Inline align="flex-start" gap="md">
                        <Icon name="bank" color="accent" />
                        <Stack gap="xs" style={{ flex: 1 }}>
                            <Text variant="h3">Connect a bank</Text>
                            <Text variant="small" color="textMuted">Skip the typing. We’ll fill in income and bills and keep them current.</Text>
                        </Stack>
                    </Inline>
                    <PlaidLinkButton size="md" />
                </Card>
            ) : null}

            {finances.monthlyNetIncome > 0 ? (
                <Section title="Where your money goes" right={<Text variant="small" color="textMuted">per month</Text>}>
                    <Card gap="md">
                        <StackedBar label="Your monthly take-home pay split into bills, debt payments, extra and what is left" segments={slices.map(sl => ({ key: sl.key, share: sl.share, color: sl.color }))} height={18} />
                        <Stack gap="sm">
                            {slices.map(sl => (
                                <Inline key={sl.key} justify="space-between" gap="md">
                                    <Inline gap="sm" style={{ flex: 1 }}><Dot color={sl.color} /><Text variant="small" numberOfLines={1} style={{ flex: 1 }}>{sl.label}</Text></Inline>
                                    <Text variant="small" color="textMuted">{`${Math.round(sl.share * 100)}%`}</Text>
                                    <Text variant="smallStrong" style={{ minWidth: 76, textAlign: 'right' }}>{money(sl.amount)}</Text>
                                </Inline>
                            ))}
                        </Stack>
                        {money_.overspent > 0 ? <Text variant="small" color="risk">Bills and minimums are {money(money_.overspent)} more than your income, so this chart is scaled to fit. Check your entries are monthly.</Text> : null}
                    </Card>
                </Section>
            ) : null}

            <Grid min={360}>
                <Stack gap="lg">
                    <Section title="Income" right={<Text variant="small" color="textMuted">{banks.length ? 'Bank + manual' : 'Manual'}</Text>}>
                        <IncomeCard />
                    </Section>

                    {history.length >= 2 ? (
                        <Section title="Income vs bills, last 12 months">
                            <Card gap="md">
                                <BarChart label="Take-home pay and bills by month" colors={[colors.accent, colors.series[2]]} groups={history.map(m => ({ label: new Date(`${m.month}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short' }), values: [m.income, m.expenses] }))} />
                                <Legend items={[{ label: 'Income', color: colors.accent }, { label: 'Bills', color: colors.series[2] }]} />
                            </Card>
                        </Section>
                    ) : null}

                    <Section title="Assets" right={<Text variant="small" color="textMuted">{money(assets.reduce((a, x) => a + x.value, 0))}</Text>}>
                        {assets.map(a => (
                            <Card key={a.id} gap="sm">
                                <Inline justify="space-between" gap="sm">
                                    <Stack style={{ flex: 1 }}><Field inline label="Asset name" value={a.name} onChange={v => setAsset(a.id, { name: v })} /></Stack>
                                    {a.plaidItemId ? <Badge>From bank</Badge> : null}
                                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${a.name}`} hitSlop={10} onPress={() => setFinances(p => ({ ...p, assets: (p.assets ?? []).filter(x => x.id !== a.id) }))}><Icon name="close" size={20} color="textMuted" /></Pressable>
                                </Inline>
                                <Inline gap="sm">
                                    <Select inline label="Asset type" value={a.type} options={ASSET_TYPES} onChange={t => setAsset(a.id, { type: t })} />
                                    <Field inline label={`${a.name} value`} prefix="$" numeric value={a.value} onChange={v => setAsset(a.id, { value: toNumber(v) })} />
                                </Inline>
                            </Card>
                        ))}
                        <Button variant="secondary" onPress={() => setFinances(p => ({ ...p, assets: [...(p.assets ?? []), { id: `asset-${Date.now()}`, name: 'New asset', type: AssetType.Cash, value: 0 }] }))}>+ Add an asset</Button>
                    </Section>
                </Stack>

                <Section title="Fixed expenses" right={<Text variant="small" color="textMuted">{money(monthlyExpensesTotal)}/mo</Text>}>
                    <Card gap="md">
                        <Inline><Field label="Monthly bills (rent, utilities, insurance…)" prefix="$" numeric value={amountOf(FIXED_ID) || ''} placeholder="0" hint="One number is enough. Anything in the breakdown below is added on top. Loan payments (mortgage, auto, student, cards) belong in Debts, not here." onChange={v => setExpense(FIXED_ID, 'Monthly bills', toNumber(v))} /></Inline>
                    </Card>

                    {otherBills.map(e => (
                        <Card key={e.id} gap="sm">
                            <Inline justify="space-between" gap="md">
                                <Stack gap="xs" style={{ flex: 1 }}><Text numberOfLines={1}>{e.name}</Text>{e.plaidItemId ? <Badge>From bank</Badge> : null}</Stack>
                                <Stack style={{ width: 120 }}><Field inline label={`${e.name} amount`} prefix="$" numeric value={e.amount} onChange={v => setExpense(e.id, e.name, toNumber(v))} /></Stack>
                                {!e.id.startsWith('property-tax-') ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${e.name}`} hitSlop={10} onPress={() => removeExpense(e.id)}><Icon name="close" size={20} color="textMuted" /></Pressable> : null}
                            </Inline>
                        </Card>
                    ))}

                    <TextButton onPress={() => setShowBreakdown(s => !s)}>{showBreakdown ? 'Hide detailed breakdown' : `Detailed breakdown (optional)${breakdownTotal > 0 ? ` · ${money(breakdownTotal)}` : ''}`}</TextButton>
                    {showBreakdown ? EXPENSE_CATEGORIES.map(cat => {
                        const total = cat.subcategories.reduce((a, s) => a + amountOf(s.name), 0);
                        const open = openCat === cat.id;
                        return (
                            <Card key={cat.id} gap="md">
                                <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpenCat(open ? null : cat.id)} style={{ minHeight: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text variant="bodyStrong">{cat.label}</Text>
                                    <Text variant="small" color="textMuted">{money(total)} {open ? '▴' : '▾'}</Text>
                                </Pressable>
                                {open ? cat.subcategories.map(s => (
                                    <Inline key={s.name}><Field label={s.name} prefix="$" numeric value={amountOf(s.name) || ''} placeholder="0" hint={s.placeholder} onChange={v => setExpense(s.name, s.name, toNumber(v))} /></Inline>
                                )) : null}
                            </Card>
                        );
                    }) : null}
                    <AddBill onAdd={(name, amount) => setExpense(`custom-${Date.now()}`, name, amount)} />
                </Section>
            </Grid>
        </Screen>
    );
};

const AddBill: React.FC<{ onAdd: (name: string, amount: number) => void }> = ({ onAdd }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    if (!open) return <Button variant="secondary" onPress={() => setOpen(true)}>+ Add another bill</Button>;
    const reset = () => { setOpen(false); setName(''); setAmount(''); };
    return (
        <Card gap="md">
            <Inline><Field label="Name" value={name} onChange={setName} placeholder="e.g. Gym" /></Inline>
            <Inline><Field label="Monthly amount" prefix="$" numeric value={amount} onChange={setAmount} /></Inline>
            <Inline gap="md">
                <Button compact disabled={!name.trim() || toNumber(amount) <= 0} onPress={() => { onAdd(name.trim(), toNumber(amount)); reset(); }}>Add</Button>
                <Button variant="ghost" compact onPress={reset}>Cancel</Button>
            </Inline>
        </Card>
    );
};

export default BudgetScreen;
