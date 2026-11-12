import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { space } from '../theme';
import { useFinance } from '../contexts/FinanceContext';
import { LOAN_PRESETS } from '../constants';
import { Loan, LoanType } from '../types';
import { calculateMinimumPayment } from '../services/loanCalculator';
import { money, toNumber } from '../lib/format';
import { Badge, Button, Card, Chip, Field, Icon, Inline, Screen, Stack, Steps, Text } from '../components/ui';
import PlaidLinkButton from '../components/PlaidLinkButton';

type Step = 'choose' | 'manual' | 'review';

const TYPE_CHIPS: { type: LoanType; label: string }[] = [
    { type: LoanType.CreditCard, label: 'Credit card' },
    { type: LoanType.Auto, label: 'Auto loan' },
    { type: LoanType.Student, label: 'Student loan' },
    { type: LoanType.Other, label: 'Other' },
];

/** First-run: connect a bank (recommended) or enter income and a first debt. */
const OnboardingScreen: React.FC = () => {
    const router = useRouter();
    const { finances, setFinances, setSettings } = useFinance();
    const [step, setStep] = useState<Step>('choose');

    const [income, setIncome] = useState('');
    const [type, setType] = useState<LoanType>(LoanType.Auto);
    const [balance, setBalance] = useState('');
    const [apr, setApr] = useState(String(LOAN_PRESETS['Auto'].apr));
    const [minPay, setMinPay] = useState('');
    const [reviewIncome, setReviewIncome] = useState<string | null>(null);

    const finish = () => {
        setSettings(p => ({ ...p, onboardingDone: true }));
        router.replace('/overview');
    };

    const pickType = (t: LoanType) => { setType(t); setApr(String(LOAN_PRESETS[t].apr)); };
    const estMin = calculateMinimumPayment(toNumber(balance), toNumber(apr), LOAN_PRESETS[type].termYears);

    const saveManual = () => {
        const bal = toNumber(balance);
        const loan: Loan | null = bal > 0 ? {
            id: `debt-${Date.now()}`, name: LOAN_PRESETS[type].name, type, balance: bal, originalAmount: bal,
            apr: toNumber(apr), term: LOAN_PRESETS[type].termYears,
            ...(minPay !== '' ? { minPaymentOverride: toNumber(minPay) } : {}), status: 'active',
        } : null;
        setFinances(prev => ({ ...prev, incomeType: 'net', monthlyNetIncome: toNumber(income) || prev.monthlyNetIncome, loans: loan ? [...prev.loans, loan] : prev.loans }));
        finish();
    };

    // Bank path: income suggestion from deposits, debts and bills from the import.
    const suggestedIncome = (() => {
        const months = (finances.incomeExpenseHistory ?? []).filter(m => m.income > 0).slice(-3);
        return months.length ? Math.round(months.reduce((a, m) => a + m.income, 0) / months.length) : 0;
    })();
    const bankLoans = finances.loans.filter(l => l.plaidItemId);
    const bankBills = finances.expenses.filter(e => e.plaidItemId && e.amount > 0);
    const incomeValue = reviewIncome ?? String(finances.monthlyNetIncome || suggestedIncome || '');

    const setLoan = (id: string, patch: Partial<Loan>) => setFinances(p => ({ ...p, loans: p.loans.map(x => (x.id === id ? { ...x, ...patch } : x)) }));

    return (
        <Screen narrow>
            <Stack style={{ height: space.huge }} />
            <Steps total={2} current={step === 'choose' ? 1 : 2} />

            {step === 'choose' ? (
                <>
                    <Stack gap="sm">
                        <Text variant="label" color="textMuted">Step 1 of 2</Text>
                        <Text variant="h1" accessibilityRole="header">Add your finances the fast way</Text>
                        <Text color="textMuted">Link your bank and we fill in income, bills and debts for you. Or enter it yourself.</Text>
                    </Stack>
                    <Card accent gap="lg" pad="roomy">
                        <Inline justify="space-between"><Text variant="h3">Connect your bank</Text><Badge tone="mint" solid>Recommended</Badge></Inline>
                        <Stack gap="md">
                            {['Income and monthly bills detected automatically', 'Loans and cards imported with balances and rates', 'Debt payments marked as paid when they happen'].map(t => (
                                <Inline key={t} align="flex-start" gap="md"><Icon name="check" size={18} color="accent" /><Text variant="small" style={{ flex: 1 }}>{t}</Text></Inline>
                            ))}
                        </Stack>
                        <PlaidLinkButton onImported={() => setStep('review')} />
                        <Inline align="flex-start" gap="sm"><Icon name="lock" size={16} color="textMuted" /><Text variant="caption" color="textMuted" style={{ flex: 1 }}>Read-only. We can never move money or see your login.</Text></Inline>
                    </Card>
                    <Card gap="xs" pad="roomy" onPress={() => setStep('manual')}>
                        <Text variant="h3">Enter it myself</Text>
                        <Text variant="small" color="textMuted">Add income and your first debt by hand. Takes about 2 minutes.</Text>
                    </Card>
                    <Button variant="ghost" onPress={finish}>Skip for now</Button>
                </>
            ) : null}

            {step === 'manual' ? (
                <>
                    <Stack gap="sm">
                        <Text variant="label" color="textMuted">Step 2 of 2 · Manual</Text>
                        <Text variant="h1" accessibilityRole="header">Income and your first debt</Text>
                    </Stack>
                    <Inline><Field label="Monthly take-home pay" prefix="$" numeric value={income} onChange={setIncome} placeholder="0" /></Inline>
                    <Stack gap="sm">
                        <Text variant="label" color="textMuted">Type of debt</Text>
                        <Inline wrap gap="sm">{TYPE_CHIPS.map(t => <Chip key={t.type} active={type === t.type} onPress={() => pickType(t.type)}>{t.label}</Chip>)}</Inline>
                    </Stack>
                    <Inline><Field label="Balance" prefix="$" numeric value={balance} onChange={setBalance} placeholder="0" /></Inline>
                    <Inline align="flex-start">
                        <Field label="APR" suffix="%" numeric value={apr} onChange={setApr} hint={LOAN_PRESETS[type].hint} />
                        <Field label="Minimum payment" prefix="$" numeric value={minPay} onChange={setMinPay} placeholder={estMin > 0 ? String(Math.round(estMin)) : '0'} />
                    </Inline>
                    <Text variant="label" color="textMuted" align="center">Expenses can wait. Add them later in Budget.</Text>
                    <Button size="lg" disabled={toNumber(balance) <= 0 && toNumber(income) <= 0} onPress={saveManual}>See my plan</Button>
                    <Button variant="ghost" onPress={() => setStep('choose')}>Back</Button>
                </>
            ) : null}

            {step === 'review' ? (
                <>
                    <Stack gap="sm">
                        <Text variant="label" color="textMuted">Step 2 of 2 · From your bank</Text>
                        <Text variant="h1" accessibilityRole="header">Here’s what we found</Text>
                        <Text color="textMuted">Check it over. Change anything that looks off.</Text>
                    </Stack>
                    <Card gap="md">
                        <Inline justify="space-between"><Text variant="label" color="textMuted">Income</Text><Badge>From bank</Badge></Inline>
                        <Inline><Field label="Monthly take-home" prefix="$" numeric value={incomeValue} onChange={setReviewIncome} hint={suggestedIncome ? `About ${money(suggestedIncome)} a month in deposits over the last few months.` : 'No deposits found yet. Enter your take-home pay.'} /></Inline>
                    </Card>
                    <Card gap="md">
                        <Inline justify="space-between"><Text variant="label" color="textMuted">Debts</Text><Text variant="label" color="textMuted">{`${bankLoans.length} account${bankLoans.length === 1 ? '' : 's'}`}</Text></Inline>
                        {bankLoans.length === 0 ? <Text variant="small" color="textMuted">No loan or card accounts found. You can add debts by hand later.</Text> : null}
                        {bankLoans.map(l => (
                            <Stack key={l.id} gap="sm">
                                <Text variant="bodyStrong">{l.name}</Text>
                                <Inline align="flex-start">
                                    <Field label="Balance" prefix="$" numeric value={l.balance} onChange={v => setLoan(l.id, { balance: toNumber(v) })} />
                                    <Field label="APR" suffix="%" numeric value={l.apr || ''} placeholder="needed" onChange={v => setLoan(l.id, { apr: toNumber(v) })} />
                                </Inline>
                                {!l.apr ? <Text variant="caption" color="amber">Your bank didn’t share the APR. Enter it for accurate results.</Text> : null}
                            </Stack>
                        ))}
                    </Card>
                    <Card gap="md">
                        <Inline justify="space-between"><Text variant="label" color="textMuted">Fixed bills</Text><Text variant="label" color="textMuted">recurring charges</Text></Inline>
                        {bankBills.length === 0 ? <Text variant="small" color="textMuted">No recurring bills found yet. Add them later in Budget.</Text> : null}
                        {bankBills.map(e => (
                            <Inline key={e.id} justify="space-between" gap="md">
                                <Text style={{ flex: 1 }} numberOfLines={1}>{e.name}</Text>
                                <Stack style={{ width: 120 }}><Field inline label={`${e.name} amount`} prefix="$" numeric value={e.amount} onChange={v => setFinances(p => ({ ...p, expenses: p.expenses.map(x => (x.id === e.id ? { ...x, amount: toNumber(v) } : x)) }))} /></Stack>
                            </Inline>
                        ))}
                    </Card>
                    <Button size="lg" onPress={() => { setFinances(prev => ({ ...prev, incomeType: 'net', monthlyNetIncome: toNumber(incomeValue) })); finish(); }}>Looks right, continue</Button>
                </>
            ) : null}
        </Screen>
    );
};

export default OnboardingScreen;
