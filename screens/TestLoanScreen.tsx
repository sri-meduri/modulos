import React, { useMemo, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { useFinance } from '../contexts/FinanceContext';
import { Loan, LoanType, RiskProfile } from '../types';
import { evaluateNewLoan, RISK_LABELS, Verdict } from '../services/loanTest';
import { formatMonthYear, addMonths } from '../services/payoff';
import { money, pct, toNumber } from '../lib/format';
import { Badge, Button, Card, Field, Gauge, Grid, Icon, Inline, PageTitle, Row, Screen, SegTabs, Stack, Text } from '../components/ui';

const VERDICT: Record<Verdict, { tone: 'accent' | 'amber' | 'risk'; badge: 'mint' | 'amber' | 'red' }> = {
    'Safe': { tone: 'accent', badge: 'mint' },
    'Borderline': { tone: 'amber', badge: 'amber' },
    'Not Recommended': { tone: 'risk', badge: 'red' },
};

const TestLoanScreen: React.FC = () => {
    const router = useRouter();
    const { finances, setFinances, settings, setSettings, activeLoans, monthlyExpensesTotal } = useFinance();
    const [amount, setAmount] = useState('18000');
    const [apr, setApr] = useState('6.9');
    const [months, setMonths] = useState('60');

    const result = useMemo(() => evaluateNewLoan(
        { amount: toNumber(amount), apr: toNumber(apr), termMonths: Math.max(1, Math.round(toNumber(months))) },
        {
            loans: activeLoans, netIncome: finances.monthlyNetIncome, grossIncome: finances.monthlyGrossIncome,
            expensesTotal: monthlyExpensesTotal, riskProfile: settings.riskProfile, strategy: settings.strategy ?? 'avalanche',
            customOrder: settings.customOrder, extra: settings.extraPayment ?? 0,
        }
    ), [amount, apr, months, activeLoans, finances.monthlyNetIncome, finances.monthlyGrossIncome, monthlyExpensesTotal, settings]);

    const verdict = VERDICT[result.verdict];
    const valid = toNumber(amount) > 0;
    const dateOf = (m: number) => (m === 0 ? 'Debt-free' : formatMonthYear(addMonths(m)));
    const noIncome = finances.monthlyNetIncome <= 0 && finances.monthlyGrossIncome <= 0;

    const addLoan = (status: 'considering' | 'active') => {
        const amt = toNumber(amount);
        const loan: Loan = {
            id: `debt-${Date.now()}`, name: status === 'considering' ? 'New loan (what-if)' : 'New loan', type: LoanType.Other,
            balance: amt, originalAmount: amt, apr: toNumber(apr), term: Math.max(1, Math.round(toNumber(months))) / 12, status,
        };
        setFinances(prev => ({ ...prev, loans: [...prev.loans, loan] }));
        router.push(status === 'considering' ? '/plan' : '/debts');
    };

    return (
        <Screen>
            <Link href="/debts"><Inline gap="xs"><Icon name="back" size={16} color="textMuted" /><Text variant="small" color="textMuted">Debts</Text></Inline></Link>
            <PageTitle>Test a new loan</PageTitle>

            <Grid min={340}>
                <Stack gap="lg">
                    <Inline align="flex-start">
                        <Field label="Amount" prefix="$" numeric value={amount} onChange={setAmount} />
                        <Field label="APR" suffix="%" numeric value={apr} onChange={setApr} />
                        <Field label="Months" keyboardType="number-pad" value={months} onChange={setMonths} />
                    </Inline>
                    <Stack gap="sm">
                        <Text variant="label" color="textMuted">Risk profile</Text>
                        <SegTabs label="Risk profile" value={settings.riskProfile}
                            options={[RiskProfile.Low, RiskProfile.Average, RiskProfile.High].map(v => ({ value: v, label: RISK_LABELS[v].label }))}
                            onChange={v => setSettings(p => ({ ...p, riskProfile: v }))} />
                        <Text variant="caption" color="textMuted">{RISK_LABELS[settings.riskProfile].blurb}</Text>
                    </Stack>
                    {noIncome ? <Card tone="amber"><Text variant="small">Add your take-home pay in <Link href="/budget"><Text variant="smallStrong" color="amber">Budget</Text></Link> for an accurate verdict.</Text></Card> : null}
                </Stack>

                <Stack gap="lg">
                    <Card gap="md" accessibilityLiveRegion="polite">
                        <Inline justify="space-between">
                            <Text variant="label" color="textMuted">Verdict</Text>
                            <Badge tone={verdict.badge} solid>{result.verdict}</Badge>
                        </Inline>
                        <Row label={<Text variant="small">DTI today → with loan</Text>} value={<Text variant="bodyStrong">{pct(result.dtiBefore)} → {pct(result.dtiAfter)}</Text>} />
                        <Gauge value={result.dtiAfter} before={result.dtiBefore} limit={result.threshold} tone={verdict.tone} label="Debt-to-income with the new loan" />
                        <Stack gap="xs">{result.reasons.map(r => <Text key={r} variant="small">{r}</Text>)}</Stack>
                        {result.incomeApproximated && !noIncome ? <Text variant="caption" color="textMuted">DTI uses take-home pay because gross income isn’t set, so it reads a little high.</Text> : null}
                    </Card>

                    <Card gap="sm">
                        <Row label="New payment" value={<Text variant="bodyStrong">{money(result.payment)}</Text>} />
                        <Row label="Left over each month" value={<Text variant="bodyStrong" color={result.leftoverAfter < 0 ? 'risk' : 'text'}>{money(result.leftoverBefore)} → {money(result.leftoverAfter)}</Text>} />
                        <Row label="Debt-free date" value={<Text variant="bodyStrong">{result.neverPaysOffAfter ? 'Not within 50 years' : `${dateOf(result.debtFreeMonthsBefore)} → ${dateOf(result.debtFreeMonthsAfter)}`}</Text>} />
                        <Row label="If pay dropped 10%" value={<Text variant="bodyStrong" color={result.stressLeftover < 0 ? 'risk' : 'text'}>{money(result.stressLeftover)} left</Text>} />
                    </Card>

                    {result.suggestions.length > 0 ? (
                        <Card tone="mint" gap="sm">
                            <Text variant="bodyStrong">What would make this safer?</Text>
                            {result.suggestions.map(s => <Text key={s} variant="small">• {s}</Text>)}
                        </Card>
                    ) : null}
                    <Text variant="caption" color="textMuted">General educational guidance, not financial advice.</Text>
                </Stack>
            </Grid>
            <Inline gap="md" align="stretch">
                <Stack style={{ flex: 1 }}><Button size="lg" disabled={!valid} onPress={() => addLoan('considering')}>Add as a what-if</Button></Stack>
                <Button size="lg" variant="secondary" disabled={!valid} onPress={() => addLoan('active')}>I took it</Button>
            </Inline>
        </Screen>
    );
};

export default TestLoanScreen;
