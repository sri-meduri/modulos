import React, { useMemo } from 'react';
import { Link, useRouter } from 'expo-router';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { DTI_THRESHOLDS } from '../constants';
import { usePlan } from '../hooks/usePlan';
import { useBanks } from '../hooks/useBanks';
import { simulatePayoff, payoffLabel, formatDuration } from '../services/payoff';
import { missedPayments, summarizeProgress } from '../services/payments';
import { nextBestAction } from '../services/nextAction';
import { compactMoney, money, pct } from '../lib/format';
import { useCountUp } from '../hooks/useCountUp';
import { Button, Card, Gauge, Grid, Icon, Inline, PageTitle, Ring, Row, Screen, Stack, Text, TextButton } from '../components/ui';
import BalanceChart from '../components/BalanceChart';
import PlaidLinkButton from '../components/PlaidLinkButton';

const OverviewScreen: React.FC = () => {
    const router = useRouter();
    const { isSample } = useAuth();
    const { finances, settings, setSettings, activeLoans, totalDebt, monthlyDebtPayments, monthlyLeftoverMoney, debtToIncomeRatio, totalAssets, netWorth, paymentCandidates } = useFinance();
    const { banks, loaded } = useBanks();
    const plan = usePlan();

    const progress = useMemo(() => summarizeProgress(finances), [finances]);
    const missed = useMemo(() => missedPayments(finances), [finances]);
    const threshold = DTI_THRESHOLDS[settings.riskProfile];
    const dtiTone = debtToIncomeRatio > threshold ? 'risk' : debtToIncomeRatio > threshold * 0.85 ? 'amber' : 'accent';

    // Insight: what an extra $100/mo would do on top of the current plan.
    const insight = useMemo(() => {
        if (activeLoans.length === 0) return null;
        const bumped = simulatePayoff(activeLoans, plan.extra + 100, plan.strategy, plan.customOrder);
        const months = plan.plan.months - bumped.months;
        const interest = plan.plan.totalInterest - bumped.totalInterest;
        if (plan.plan.neverPaysOff || months < 1 || interest < 1) return null;
        return `+$100/mo: ${formatDuration(months)} sooner, ${compactMoney(interest)} less interest.`;
    }, [activeLoans, plan]);

    // Old dashboard's "projected savings": what putting ALL available money toward debt would do.
    const allIn = useMemo(() => {
        if (activeLoans.length === 0 || monthlyLeftoverMoney < 25) return null;
        const r = simulatePayoff(activeLoans, Math.floor(monthlyLeftoverMoney), plan.strategy, plan.customOrder);
        const saved = plan.baseline.totalInterest - r.totalInterest;
        if (r.neverPaysOff || saved < 1) return null;
        return `All ${money(monthlyLeftoverMoney)} available: debt-free ${payoffLabel(r)}, ${compactMoney(saved)} less interest.`;
    }, [activeLoans, monthlyLeftoverMoney, plan]);

    const action = useMemo(() => nextBestAction({
        finances, settings, activeLoans, leftover: monthlyLeftoverMoney, dti: debtToIncomeRatio,
        unconfirmedPayments: (finances.payments ?? []).filter(p => p.source === 'detected' && !p.confirmed).length,
        paymentCandidates: paymentCandidates.length, hasBank: banks.length > 0,
    }), [finances, settings, activeLoans, monthlyLeftoverMoney, debtToIncomeRatio, paymentCandidates.length, banks.length]);

    const runAction = () => {
        if (action.applyExtra !== undefined) setSettings(p => ({ ...p, extraPayment: action.applyExtra }));
        else if (action.route) router.push(action.route as never);
    };

    const animatedDebt = useCountUp(totalDebt);
    const showNudge = loaded && !isSample && banks.length === 0 && !settings.bankNudgeDismissed;

    if (activeLoans.length === 0) {
        return (
            <Screen narrow>
                <PageTitle>Overview</PageTitle>
                <Card gap="lg">
                    <Text variant="h2">Add your first debt</Text>
                    <Text color="textMuted">Your debt-free date, progress and plan appear here as soon as there is a debt to track.</Text>
                    <Button size="lg" onPress={() => router.push('/debts?add=1')}>+ Add a debt</Button>
                    <PlaidLinkButton variant="secondary" size="md">Import from bank</PlaidLinkButton>
                </Card>
            </Screen>
        );
    }

    return (
        <Screen>
            <PageTitle>Overview</PageTitle>

            {missed.length > 0 ? (
                <Card tone="amber">
                    <Text variant="small"><Text variant="smallStrong" color="amber">Heads up · </Text>No payment seen yet this month for {missed.map(l => l.name).join(', ')}. The due date has passed. <Link href="/progress"><Text variant="smallStrong" color="amber">Log it</Text></Link> if you already paid.</Text>
                </Card>
            ) : null}
            {paymentCandidates.length > 0 ? (
                <Card tone="amber">
                    <Text variant="small"><Text variant="smallStrong" color="amber">Is this a debt payment? · </Text>{paymentCandidates.length} bank transaction{paymentCandidates.length === 1 ? '' : 's'} could be. <Link href="/progress"><Text variant="smallStrong" color="amber">Review</Text></Link></Text>
                </Card>
            ) : null}

            <Card tone={action.tone === 'accent' ? 'mint' : action.tone === 'amber' ? 'amber' : 'default'} accent={action.tone === 'risk'} gap="md">
                <Inline align="flex-start" gap="md">
                    <Icon name="target" color={action.tone === 'accent' ? 'accent' : action.tone === 'amber' ? 'amber' : 'risk'} />
                    <Stack gap="xs" style={{ flex: 1 }}>
                        <Text variant="captionStrong" color="textMuted">NEXT BEST ACTION</Text>
                        <Text variant="h3">{action.title}</Text>
                        <Text variant="small" color="textMuted">{action.detail}</Text>
                    </Stack>
                </Inline>
                <Button compact onPress={runAction}>{action.cta}</Button>
            </Card>

            <Grid min={340}>
                <Stack gap="lg">
                    <Card gap="lg" pad="roomy">
                        <Inline justify="space-between" gap="lg">
                            <Stack gap="xs" style={{ flexShrink: 1 }}>
                                <Text variant="label" color="textMuted">Debt-free date</Text>
                                <Text variant="hero">{payoffLabel(plan.plan)}</Text>
                                <Text variant="smallStrong" color="accent">{plan.extra > 0 ? `On track · ${money(plan.extra)} extra a month` : 'Minimums only · set an extra in Plan'}</Text>
                            </Stack>
                            <Ring value={progress.percent} label={`${Math.round(progress.percent * 100)} percent paid off`} />
                        </Inline>
                        <Row label={<Text variant="small" color="textMuted">Total debt</Text>} value={<Text variant="bodyStrong">{money(animatedDebt)}</Text>} />
                        <Row label={<Text variant="small" color="textMuted">Paid so far</Text>} value={<Text variant="bodyStrong" color="accent">{`${money(progress.paidOff)} of ${money(progress.startingTotal)}`}</Text>} />
                    </Card>

                    <Inline gap="md" align="stretch">
                        <Kpi label="Min. payments" value={money(monthlyDebtPayments)} />
                        <Kpi label="DTI" value={pct(debtToIncomeRatio)} tone={dtiTone === 'accent' ? 'text' : dtiTone} />
                        <Kpi label="Left over" value={money(monthlyLeftoverMoney)} tone={monthlyLeftoverMoney < 0 ? 'risk' : 'text'} />
                    </Inline>
                    {monthlyLeftoverMoney < 0 ? <Text variant="small" color="risk">Your bills and minimums exceed your income by {money(-monthlyLeftoverMoney)} a month.</Text> : null}
                    {debtToIncomeRatio > threshold ? <Text variant="small" color="risk">Your debt-to-income ratio is above the {pct(threshold)} limit for your risk profile.</Text> : null}
                    <Card>
                        <Gauge value={debtToIncomeRatio} limit={threshold} tone={dtiTone} label="Debt-to-income ratio against your limit" />
                    </Card>
                </Stack>

                <Stack gap="lg">
                    <Card gap="sm">
                        <Inline justify="space-between"><Text variant="label" color="textMuted">Debt balance</Text><Text variant="label" color="textMuted">Now → {payoffLabel(plan.plan)}</Text></Inline>
                        <BalanceChart history={finances.balanceHistory} projection={plan.plan.balanceSeries} currentBalance={totalDebt} />
                    </Card>

                    {insight ? <Card tone="amber"><Text variant="small"><Text variant="smallStrong" color="amber">Faster · </Text>{insight}</Text></Card> : null}
                    {allIn ? <Card tone="amber"><Text variant="small"><Text variant="smallStrong" color="amber">All in · </Text>{allIn}</Text></Card> : null}

                    {(totalAssets > 0 || (finances.assets ?? []).length > 0) ? (
                        <Card>
                            <Row label="Assets" value={money(totalAssets)} />
                            <Row label="Net worth" value={<Text variant="bodyStrong" color={netWorth < 0 ? 'risk' : 'accent'}>{money(netWorth)}</Text>} />
                        </Card>
                    ) : null}

                    {showNudge ? (
                        <Card tone="mint" gap="md">
                            <Inline align="flex-start" gap="md">
                                <Icon name="bank" color="accent" />
                                <Stack gap="xs" style={{ flex: 1 }}>
                                    <Text variant="h3">Skip the typing</Text>
                                    <Text variant="small" color="textMuted">Connect a bank and we fill in income, bills and debts, then log payments when they happen.</Text>
                                </Stack>
                                <TextButton color="textMuted" onPress={() => setSettings(p => ({ ...p, bankNudgeDismissed: true }))}>Dismiss</TextButton>
                            </Inline>
                            <PlaidLinkButton size="md" />
                        </Card>
                    ) : null}
                </Stack>
            </Grid>
        </Screen>
    );
};

const Kpi: React.FC<{ label: string; value: string; tone?: 'text' | 'risk' | 'amber' }> = ({ label, value, tone = 'text' }) => (
    <Card gap="xs" pad="compact" style={{ flex: 1 }}>
        <Text variant="caption" color="textMuted">{label}</Text>
        <Text variant="stat" color={tone}>{value}</Text>
    </Card>
);

export default OverviewScreen;
