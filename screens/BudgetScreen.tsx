import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { Link } from 'expo-router';
import { colors } from '../theme';
import { useFinance } from '../contexts/FinanceContext';
import { useBanks } from '../hooks/useBanks';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import { allocateIncome, expenseCategory } from '../services/allocation';
import { Expense } from '../types';
import { money } from '../lib/format';
import { BarChart, Badge, Button, Card, Chip, Dot, Grid, Icon, Inline, Legend, PageTitle, Screen, Section, SegTabs, Stack, StackedBar, Text } from '../components/ui';
import IncomeCard from '../components/IncomeCard';
import AddExpenseSheet, { CATEGORY_LABELS } from '../components/AddExpenseSheet';
import PlaidLinkButton from '../components/PlaidLinkButton';

type Tab = 'summary' | 'income' | 'expenses';

const fullDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
const monthName = (key: string) => new Date(`${key}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short' });

const BudgetScreen: React.FC = () => {
    const { isSample } = useAuth();
    const { finances, setFinances, settings, bankLinked, monthlyExpensesTotal, monthlyDebtPayments, monthlyLeftoverMoney } = useFinance();
    const { banks, loaded } = useBanks();
    const [tab, setTab] = useState<Tab>('summary');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editing, setEditing] = useState<Expense | undefined>();
    const [txFilter, setTxFilter] = useState<'all' | 'spending' | 'income'>('all');
    const tx = useTransactions(bankLinked && tab === 'expenses');

    const expenses = finances.expenses.filter(e => e.amount > 0);
    const alloc = allocateIncome(finances.monthlyNetIncome, finances.expenses, monthlyDebtPayments, settings.extraPayment ?? 0);
    const kindColor = { debt: colors.series[2], extra: colors.accent, left: colors.accentDeep } as const;
    const billColors = [colors.series[3], colors.series[4], colors.series[5], colors.line, colors.textMuted];
    let billIdx = 0;
    const slices = alloc.slices.map(sl => ({ ...sl, color: sl.kind === 'bills' ? billColors[billIdx++ % billColors.length] : kindColor[sl.kind] }));

    // Income vs bills by month comes from the bank's real transaction dates, so it exists only with a linked bank.
    const history = useMemo(() => (finances.incomeExpenseHistory ?? []).filter(m => m.income > 0 || m.expenses > 0), [finances.incomeExpenseHistory]);

    const grouped = useMemo(() => {
        const byCat = new Map<string, Expense[]>();
        for (const e of expenses) {
            const c = expenseCategory(e);
            byCat.set(c, [...(byCat.get(c) ?? []), e]);
        }
        return CATEGORY_LABELS.filter(c => byCat.has(c)).map(c => ({ label: c, items: byCat.get(c)!, total: byCat.get(c)!.reduce((a, e) => a + e.amount, 0) }));
    }, [expenses]);

    const save = (e: Expense) => setFinances(prev => ({
        ...prev,
        expenses: prev.expenses.some(x => x.id === e.id) ? prev.expenses.map(x => (x.id === e.id ? { ...x, ...e } : x)) : [...prev.expenses, e],
    }));
    const remove = (id: string) => setFinances(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
    const open = (e?: Expense) => { setEditing(e); setSheetOpen(true); };

    const shownTx = tx.transactions.filter(t => (txFilter === 'all' ? true : txFilter === 'spending' ? t.amount > 0 : t.amount < 0)).slice(0, 60);

    return (
        <Screen>
            <PageTitle>Budget</PageTitle>

            <Card gap="xs" pad="roomy">
                <Text variant="label" color="textMuted">Left over each month after bills and minimums</Text>
                <Text variant="hero" color={monthlyLeftoverMoney < 0 ? 'risk' : 'accent'}>{money(monthlyLeftoverMoney)}</Text>
                <Text variant="label" color="textMuted">{money(finances.monthlyNetIncome)} income − {money(monthlyExpensesTotal)} expenses − {money(monthlyDebtPayments)} debt minimums</Text>
            </Card>

            <SegTabs label="Budget sections" value={tab} options={[{ value: 'summary', label: 'Summary' }, { value: 'income', label: 'Income' }, { value: 'expenses', label: 'Expenses' }]} onChange={setTab} />

            {tab === 'summary' ? (
                <Grid min={360}>
                    <Stack gap="lg">
                        {finances.monthlyNetIncome > 0 ? (
                            <Section title="Where your money goes" right={<Text variant="small" color="textMuted">per month</Text>}>
                                <Card gap="md">
                                    <StackedBar label="Your monthly take-home pay split into expenses, debt payments, extra and what is left" segments={slices.map(sl => ({ key: sl.key, share: sl.share, color: sl.color }))} height={18} />
                                    <Stack gap="sm">
                                        {slices.map(sl => (
                                            <Inline key={sl.key} justify="space-between" gap="md">
                                                <Inline gap="sm" style={{ flex: 1 }}><Dot color={sl.color} /><Text variant="small" numberOfLines={1} style={{ flex: 1 }}>{sl.label}</Text></Inline>
                                                <Text variant="small" color="textMuted">{`${Math.round(sl.share * 100)}%`}</Text>
                                                <Text variant="smallStrong" style={{ minWidth: 76, textAlign: 'right' }}>{money(sl.amount)}</Text>
                                            </Inline>
                                        ))}
                                    </Stack>
                                    {alloc.overspent > 0 ? <Text variant="small" color="risk">Expenses and minimums are {money(alloc.overspent)} more than your income, so this is scaled to fit. Check that every entry is monthly.</Text> : null}
                                </Card>
                            </Section>
                        ) : (
                            <Card tone="amber" gap="sm"><Text variant="small">Add your income to see where your money goes.</Text><Button compact onPress={() => setTab('income')}>Add income</Button></Card>
                        )}
                    </Stack>
                    <Stack gap="lg">
                        {bankLinked && history.length >= 2 ? (
                            <Section title={`Income vs expenses, last ${history.length} months`}>
                                <Card gap="md">
                                    <BarChart label="Income and expenses by month, from your bank" colors={[colors.accent, colors.series[2]]} groups={history.map(m => ({ label: monthName(m.month), values: [m.income, m.expenses] }))} />
                                    <Legend items={[{ label: 'Income', color: colors.accent }, { label: 'Expenses', color: colors.series[2] }]} />
                                </Card>
                            </Section>
                        ) : (
                            <Card tone="outline" gap="sm">
                                <Text variant="bodyStrong">Income vs expenses over time</Text>
                                <Text variant="small" color="textMuted">Connect a bank to see this month by month. We use the real dates of your deposits and spending, which can’t be entered by hand.</Text>
                                {loaded && !isSample && banks.length === 0 ? <PlaidLinkButton size="md" variant="secondary" /> : null}
                            </Card>
                        )}
                    </Stack>
                </Grid>
            ) : null}

            {tab === 'income' ? <IncomeCard /> : null}

            {tab === 'expenses' ? (
                <Stack gap="lg">
                    <Inline justify="space-between" gap="md">
                        <Stack gap="xs"><Text variant="h3">All your expenses</Text><Text variant="small" color="textMuted">{money(monthlyExpensesTotal)} a month · everything you’ve entered or imported</Text></Stack>
                        <Button compact onPress={() => open()}>+ Add expense</Button>
                    </Inline>

                    {grouped.length === 0 ? (
                        <Card gap="md">
                            <Text color="textMuted">No expenses yet. Add what you pay each month (rent, utilities, groceries, subscriptions) so your leftover money is accurate.</Text>
                            <Button onPress={() => open()}>+ Add your first expense</Button>
                            {!isSample ? <PlaidLinkButton size="md" variant="secondary">Or import from a bank</PlaidLinkButton> : null}
                        </Card>
                    ) : (
                        <Grid min={340}>
                            {grouped.map(g => (
                                <Card key={g.label} gap="sm">
                                    <Inline justify="space-between"><Text variant="bodyStrong">{g.label}</Text><Text variant="smallStrong" color="textMuted">{money(g.total)}</Text></Inline>
                                    {g.items.map(e => {
                                        const isTax = e.id.startsWith('property-tax-');
                                        return (
                                            <Inline key={e.id} justify="space-between" gap="md">
                                                <Stack gap="xs" style={{ flex: 1 }}>
                                                    <Text numberOfLines={1}>{isTax ? 'Property tax' : e.name === 'Monthly bills' && e.id === 'fixed-total' ? 'Monthly bills (total)' : e.name}</Text>
                                                    {e.plaidItemId ? <Badge>From bank</Badge> : isTax ? <Text variant="caption" color="textMuted">Set on your mortgage in <Link href="/debts"><Text variant="caption" color="accent">Debts</Text></Link></Text> : null}
                                                </Stack>
                                                <Text variant="bodyStrong">{money(e.amount)}</Text>
                                                {!isTax ? (
                                                    <Inline gap="sm">
                                                        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${e.name}`} hitSlop={10} onPress={() => open(e)}><Icon name="edit" size={18} color="textMuted" /></Pressable>
                                                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${e.name}`} hitSlop={10} onPress={() => remove(e.id)}><Icon name="close" size={18} color="textMuted" /></Pressable>
                                                    </Inline>
                                                ) : null}
                                            </Inline>
                                        );
                                    })}
                                </Card>
                            ))}
                        </Grid>
                    )}

                    <Section title="Transactions">
                        {bankLinked ? (
                            <Card gap="md">
                                <Inline wrap gap="sm">
                                    {([['all', 'All'], ['spending', 'Spending'], ['income', 'Income']] as const).map(([v, l]) => <Chip key={v} active={txFilter === v} onPress={() => setTxFilter(v)}>{l}</Chip>)}
                                </Inline>
                                {tx.loading ? <Text variant="small" color="textMuted">Loading your transactions…</Text> : null}
                                {tx.error ? <Text variant="small" color="risk">{tx.error}</Text> : null}
                                {!tx.loading && !tx.error && shownTx.length === 0 ? <Text variant="small" color="textMuted">No transactions found for the last 60 days.</Text> : null}
                                {shownTx.map(t => (
                                    <Inline key={t.id} justify="space-between" gap="md">
                                        <Stack gap="xs" style={{ flex: 1 }}>
                                            <Text variant="small" numberOfLines={1}>{t.name}</Text>
                                            <Text variant="caption" color="textMuted">{fullDate(t.date)}{t.account ? ` · ${t.account}` : ''}</Text>
                                        </Stack>
                                        <Text variant="smallStrong" color={t.amount < 0 ? 'accent' : 'text'}>{t.amount < 0 ? '+' : '−'}{money(Math.abs(t.amount), { cents: true })}</Text>
                                    </Inline>
                                ))}
                                {tx.transactions.length > 60 ? <Text variant="caption" color="textMuted">Showing the 60 most recent.</Text> : null}
                            </Card>
                        ) : (
                            <Card tone="outline" gap="sm">
                                <Text variant="small" color="textMuted">Every transaction, with dates, is available when you connect a bank. In manual mode you see the monthly amounts you entered above.</Text>
                                {!isSample ? <PlaidLinkButton size="md" variant="secondary" /> : null}
                            </Card>
                        )}
                    </Section>
                </Stack>
            ) : null}

            <AddExpenseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} expense={editing} onSave={save} />
        </Screen>
    );
};

export default BudgetScreen;
