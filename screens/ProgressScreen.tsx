import React, { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { useFinance } from '../contexts/FinanceContext';
import { Payment } from '../types';
import { confirmPayment, logManualPayment, milestonesFor, planVsActual, removePayment, summarizeProgress } from '../services/payments';
import { usePlan } from '../hooks/usePlan';
import { formatMonthYear } from '../services/payoff';
import { getEffectiveMinPayment } from '../services/loanCalculator';
import { money, toNumber } from '../lib/format';
import { colors } from '../theme';
import { BarChart, Button, Card, Chart, checkpoints, Chip, Field, Grid, Icon, Inline, Legend, PageTitle, ProgressBar, Screen, Section, Sheet, Stack, Text, TextButton } from '../components/ui';

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const ProgressScreen: React.FC = () => {
    const { finances, setFinances, activeLoans, paymentCandidates, resolveCandidate, bankLinked } = useFinance();
    const [logOpen, setLogOpen] = useState(false);
    const [loanId, setLoanId] = useState('');
    const [amount, setAmount] = useState('');
    const [toast, setToast] = useState<string | null>(null);

    const progress = useMemo(() => summarizeProgress(finances), [finances]);
    const milestones = useMemo(() => milestonesFor(finances, progress), [finances, progress]);
    const plan = usePlan();
    const plannedMonthly = plan.plan.totalMinimum + plan.extra;
    const months = useMemo(() => planVsActual(finances, plannedMonthly), [finances, plannedMonthly]);
    const thisMonth = months[months.length - 1];
    const gap = thisMonth.actual - thisMonth.planned;
    const nextUp = milestones.find(m => !m.done);
    const payments = finances.payments ?? [];
    const loanName = (id: string, p?: Payment) => finances.loans.find(l => l.id === id)?.name ?? p?.payee ?? 'Debt';
    const unconfirmed = payments.filter(p => p.source === 'detected' && !p.confirmed);
    const history = (finances.balanceHistory ?? []).map(h => h.balance);

    const pick = (id: string) => {
        setLoanId(id);
        const loan = activeLoans.find(l => l.id === id);
        setAmount(loan ? String(Math.round(getEffectiveMinPayment(loan))) : '');
    };
    const openLog = () => { pick(activeLoans[0]?.id ?? ''); setLogOpen(true); };

    const submit = () => {
        const amt = toNumber(amount);
        if (!loanId || amt <= 0) return;
        const out = logManualPayment(finances, { loanId, amount: amt });
        setFinances(out.finances);
        setLogOpen(false);
        setToast(out.paidOff ? `${loanName(loanId)} is paid off. 🎉` : `Logged ${money(amt)}. ${money(amt - out.interestPortion)} went to principal, ${money(out.interestPortion)} to interest.`);
    };

    return (
        <Screen>
            <PageTitle right={activeLoans.length > 0 ? <Button compact onPress={openLog}>Log a payment</Button> : undefined}>Progress</PageTitle>

            {toast ? <Card tone="mint"><Inline justify="space-between" gap="md"><Text variant="small" style={{ flex: 1 }}>{toast}</Text><TextButton color="textMuted" onPress={() => setToast(null)}>Dismiss</TextButton></Inline></Card> : null}

            {unconfirmed.slice(0, 2).map(p => (
                <Card key={p.id} tone="mint" gap="md">
                    <Stack gap="xs">
                        <Text variant="h3">Payment detected</Text>
                        <Text variant="small" color="textMuted">{money(p.amount)} to {loanName(p.loanId, p)} cleared on {fmtDate(p.date)}. Is that right?</Text>
                    </Stack>
                    <Inline gap="md" wrap>
                        <Button compact onPress={() => setFinances(prev => confirmPayment(prev, p.id))}>Yes, that’s right</Button>
                        <Button variant="secondary" compact onPress={() => setFinances(prev => removePayment(prev, p.id))}>Not a debt payment</Button>
                    </Inline>
                </Card>
            ))}

            {paymentCandidates.slice(0, 2).map(c => (
                <Card key={c.id} tone="amber" gap="md">
                    <Stack gap="xs">
                        <Text variant="h3">Is this a debt payment?</Text>
                        <Text variant="small">{money(c.amount)} to {c.payee} on {fmtDate(c.date)}. Tell us once and we’ll remember it.</Text>
                    </Stack>
                    <Inline wrap gap="sm">
                        {activeLoans.map(l => <Chip key={l.id} onPress={() => resolveCandidate(c.id, l.id)}>{l.name}</Chip>)}
                        <Chip onPress={() => resolveCandidate(c.id, null)}>Not a debt</Chip>
                    </Inline>
                </Card>
            ))}

            <Grid min={340}>
                <Stack gap="lg">
                    <Card gap="md" pad="roomy">
                        <Inline justify="space-between" align="baseline"><Text variant="label" color="textMuted">Total paid off</Text><Text variant="label" color="textMuted">of {money(progress.startingTotal)}</Text></Inline>
                        <Text variant="hero">{money(progress.paidOff)}</Text>
                        <ProgressBar value={progress.percent} label="Total paid off" />
                        {progress.extraPaidTotal > 0 ? <Text variant="smallStrong" color="accent">{money(progress.extraPaidTotal)} paid above minimums so far.</Text> : null}
                    </Card>
                    {bankLinked && plannedMonthly > 0 ? (
                        <Card gap="md">
                            <Inline justify="space-between"><Text variant="h3">Plan vs actual</Text><Text variant="label" color="textMuted">last 6 months</Text></Inline>
                            <BarChart label="Planned payments compared with payments actually made, by month" colors={[colors.line, colors.accent]} groups={months.map(m => ({ label: m.label, values: [m.planned, m.actual] }))} />
                            <Legend items={[{ label: 'Planned', color: colors.line }, { label: 'Actual', color: colors.accent }]} />
                            <ProgressBar value={thisMonth.planned > 0 ? thisMonth.actual / thisMonth.planned : 0} label="This month's payments against plan" />
                            <Inline justify="space-between" gap="md">
                                <Text variant="small">This month: {money(thisMonth.actual)} of {money(thisMonth.planned)}</Text>
                                <Text variant="smallStrong" color={gap >= 0 ? 'accent' : 'amber'}>{gap >= 0 ? (gap > 0 ? `${money(gap)} ahead` : 'On plan') : `${money(-gap)} to go`}</Text>
                            </Inline>
                            <Text variant="caption" color="textMuted">Plan = every minimum payment plus your {money(plan.extra)} extra. Change it in Plan.</Text>
                        </Card>
                    ) : (
                        <Card tone="outline" gap="sm">
                            <Text variant="bodyStrong">Plan vs actual</Text>
                            <Text variant="small" color="textMuted">Connect a bank to compare what you planned with what you actually paid each month. We read the real payment dates from your accounts.</Text>
                            <Link href="/profile/accounts"><Text variant="smallStrong" color="accent">Connect a bank</Text></Link>
                        </Card>
                    )}
                    {history.length >= 2 ? (
                        <Card gap="sm">
                            <Text variant="label" color="textMuted">Balance history</Text>
                            <Chart height={170} label="Total debt balance by month" xTicks={checkpoints((finances.balanceHistory ?? []).map(h => { const [y, m] = h.month.split('-').map(Number); return formatMonthYear(new Date(y, m - 1, 1)); }), 4)} series={[{ data: history, color: colors.accent, fill: true }]} />
                        </Card>
                    ) : null}
                </Stack>

                <Stack gap="lg">
                    <Section title="Milestones" right={<Text variant="small" color="textMuted">{`${milestones.filter(m => m.done).length} of ${milestones.length}`}</Text>}>
                        {nextUp ? (
                            <Card tone="mint" accent gap="md">
                                <Inline gap="md" align="flex-start">
                                    <Icon name="flag" color="accent" />
                                    <Stack gap="xs" style={{ flex: 1 }}>
                                        <Text variant="captionStrong" color="accent">NEXT UP</Text>
                                        <Text variant="h3">{nextUp.label}</Text>
                                        <Text variant="small" color="textMuted">{nextUp.detail}</Text>
                                    </Stack>
                                </Inline>
                                <ProgressBar value={nextUp.progress} label={`Progress toward ${nextUp.label}`} />
                                <Text variant="label" color="textMuted">{nextUp.caption}</Text>
                            </Card>
                        ) : <Card tone="mint"><Text variant="bodyStrong" color="accent">Every milestone reached. Debt-free!</Text></Card>}
                        <Grid min={200} gap="md">
                            {milestones.map(m => (
                                <Card key={m.id} gap="sm" tone={m.done ? 'mint' : 'default'} pad="compact">
                                    <Inline gap="sm"><Icon name={m.done ? 'trophy' : 'target'} size={20} color={m.done ? 'accent' : 'textMuted'} /><Text variant="smallStrong" color={m.done ? 'accent' : 'text'} style={{ flex: 1 }}>{m.label}</Text></Inline>
                                    <ProgressBar value={m.progress} label={`${m.label} progress`} />
                                    <Text variant="caption" color="textMuted">{m.done ? 'Reached' : m.caption}</Text>
                                </Card>
                            ))}
                        </Grid>
                    </Section>
                </Stack>

            </Grid>

            <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Log a payment">
                <Inline wrap gap="sm">{activeLoans.map(l => <Chip key={l.id} active={loanId === l.id} onPress={() => pick(l.id)}>{l.name}</Chip>)}</Inline>
                <Inline><Field label="Amount paid" prefix="$" numeric value={amount} onChange={setAmount} /></Inline>
                <Text variant="caption" color="textMuted">Part of each payment covers that month’s interest; the rest lowers your balance.</Text>
                <Button size="lg" disabled={!loanId || toNumber(amount) <= 0} onPress={submit}>Log payment</Button>
            </Sheet>
        </Screen>
    );
};

export default ProgressScreen;
