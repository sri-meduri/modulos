import React, { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { colors } from '../theme';
import { useFinance } from '../contexts/FinanceContext';
import { Payment } from '../types';
import { confirmPayment, logManualPayment, milestonesFor, removePayment, summarizeProgress } from '../services/payments';
import { getEffectiveMinPayment } from '../services/loanCalculator';
import { money, toNumber } from '../lib/format';
import { Badge, Button, Card, Chart, Chip, Field, Grid, Inline, PageTitle, ProgressBar, Screen, Section, Sheet, Stack, Text, TextButton } from '../components/ui';

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const ProgressScreen: React.FC = () => {
    const { finances, setFinances, activeLoans, paymentCandidates, resolveCandidate } = useFinance();
    const [logOpen, setLogOpen] = useState(false);
    const [loanId, setLoanId] = useState('');
    const [amount, setAmount] = useState('');
    const [toast, setToast] = useState<string | null>(null);

    const progress = useMemo(() => summarizeProgress(finances), [finances]);
    const milestones = useMemo(() => milestonesFor(finances, progress), [finances, progress]);
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
                    {history.length >= 2 ? (
                        <Card gap="sm">
                            <Text variant="label" color="textMuted">Balance history</Text>
                            <Chart height={130} label="Total debt balance by month" series={[{ data: history, color: colors.accent, fill: true }]} />
                        </Card>
                    ) : null}
                    <Section title="Milestones">
                        <Inline wrap gap="sm">
                            {milestones.map(m => <Badge key={m.id} tone={m.done ? 'mint' : 'gray'}>{`${m.done ? '★' : '○'} ${m.label}`}</Badge>)}
                        </Inline>
                    </Section>
                </Stack>

                <Section title="Recent payments">
                    {payments.length === 0 ? <Card><Text variant="small" color="textMuted">No payments yet. Log one when you pay, or <Link href="/profile/accounts"><Text variant="smallStrong" color="accent">connect a bank</Text></Link> and we’ll catch them automatically.</Text></Card> : null}
                    {payments.slice(0, 12).map(p => (
                        <Card key={p.id} gap="xs">
                            <Inline justify="space-between" gap="md">
                                <Stack gap="xs" style={{ flex: 1 }}>
                                    <Text numberOfLines={1}>{loanName(p.loanId, p)}</Text>
                                    <Text variant="label" color="textMuted">{fmtDate(p.date)} · {p.source === 'detected' ? (p.confirmed ? 'auto-detected' : 'detected, unconfirmed') : 'marked by you'}{(p.extra ?? 0) > 0 ? ` · ${money(p.extra!)} extra` : ''}</Text>
                                </Stack>
                                <Text variant="bodyStrong">{money(p.amount)}</Text>
                            </Inline>
                        </Card>
                    ))}
                </Section>
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
