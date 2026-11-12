import React, { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { colors } from '../theme';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { PayoffStrategy } from '../types';
import { usePlan } from '../hooks/usePlan';
import { addMonths, extraForTarget, formatDuration, formatMonthYear, monthsBetweenNow, payoffLabel, simulatePayoff } from '../services/payoff';
import { money } from '../lib/format';
import { Avatar, Badge, Button, Card, Chart, Chip, Field, Grid, Inline, Legend, PageTitle, Screen, Section, SegTabs, Select, Slider, StackedBar, Dot, Stack, Stepper, Text, TextButton } from '../components/ui';
import { getEffectiveMinPayment } from '../services/loanCalculator';

const STRATEGIES: { value: PayoffStrategy; label: string }[] = [
    { value: 'avalanche', label: 'Avalanche' },
    { value: 'snowball', label: 'Snowball' },
    { value: 'custom', label: 'Custom' },
];
const BLURB: Record<PayoffStrategy, string> = {
    avalanche: 'Highest APR first. Pays the least interest overall.',
    snowball: 'Smallest balance first. Quick wins keep you motivated.',
    custom: 'You choose the order.',
};
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Samples a series to ~`points` entries so long payoffs stay readable. */
const sample = <T,>(n: number, points: number, at: (i: number) => T): T[] => {
    const stride = Math.max(1, Math.ceil(n / points));
    const out: T[] = [];
    for (let i = 0; i <= n; i += stride) out.push(at(i));
    if ((n % stride) !== 0) out.push(at(n));
    return out;
};

const PlanScreen: React.FC = () => {
    const { isGuest, isSample, openAuth } = useAuth();
    const { finances, settings, setSettings, activeLoans, consideringLoans, monthlyLeftoverMoney } = useFinance();
    const plan = usePlan();
    const [target, setTarget] = useState(settings.targetDate ?? '');
    const [includeIds, setIncludeIds] = useState<string[]>([]);
    const [refiId, setRefiId] = useState('');
    const [refiApr, setRefiApr] = useState('');

    // Money available for debt payoff = what is left after bills and minimums. The slider runs
    // from $0 to that amount, so its right end is always "use everything available".
    const available = Math.max(0, Math.floor(monthlyLeftoverMoney));
    const cap = Math.max(25, Math.floor(available / 25) * 25);
    const [payView, setPayView] = useState<'total' | 'debt'>('total');
    const extra = plan.extra;
    const setExtra = (v: number) => setSettings(p => ({ ...p, extraPayment: Math.max(0, Math.round(v)) }));
    const names = useMemo(() => new Map(finances.loans.map(l => [l.id, l.name])), [finances.loans]);

    const paySegments = useMemo(() => {
        const mins = activeLoans.map(l => ({ id: l.id, name: l.name, amount: getEffectiveMinPayment(l) }));
        const total = (plan.plan.totalMinimum + extra) || 1;
        const out: { key: string; label: string; amount: number; share: number; color: string }[] = [];
        if (payView === 'total') {
            out.push({ key: 'min', label: 'Minimum payments', amount: plan.plan.totalMinimum, share: plan.plan.totalMinimum / total, color: colors.series[2] });
        } else {
            plan.plan.order.forEach((id, k) => { const m = mins.find(x => x.id === id); if (m) out.push({ key: id, label: `${m.name} minimum`, amount: m.amount, share: m.amount / total, color: colors.series[(k + 2) % colors.series.length] }); });
        }
        if (extra > 0) out.push({ key: 'extra', label: 'Extra payment', amount: extra, share: extra / total, color: colors.accent });
        return out;
    }, [activeLoans, plan, extra, payView]);

    const horizon = Math.max(plan.baseline.months, plan.plan.months);
    const compare = useMemo(() => {
        const idx = sample(horizon, 40, i => i);
        return {
            idx,
            min: idx.map(i => plan.baseline.balanceSeries[Math.min(i, plan.baseline.months)] ?? 0),
            withExtra: idx.map(i => plan.plan.balanceSeries[Math.min(i, plan.plan.months)] ?? 0),
        };
    }, [plan, horizon]);

    const stacked = useMemo(() => {
        const idx = sample(plan.plan.months, 30, i => i);
        return plan.plan.order.map((id, k) => ({ data: idx.map(i => plan.plan.loanSeries[id]?.[i] ?? 0), color: colors.series[k % colors.series.length] }));
    }, [plan]);

    const targetMonths = target ? monthsBetweenNow(target) : 0;
    const needed = useMemo(
        () => (target && targetMonths > 0 ? extraForTarget(activeLoans, targetMonths, plan.strategy, plan.customOrder) : undefined),
        [target, targetMonths, activeLoans, plan.strategy, plan.customOrder]
    );

    const milestones = useMemo(() => {
        const s = plan.plan.balanceSeries;
        if (s.length < 2 || plan.plan.neverPaysOff) return [];
        const out: { label: string; at: number }[] = [];
        const half = s.findIndex(b => b <= s[0] / 2);
        const firstOff = Math.min(...Object.values(plan.plan.payoffMonth));
        if (Number.isFinite(firstOff) && plan.plan.order.length > 1) out.push({ label: 'First debt paid off', at: firstOff });
        if (half > 0) out.push({ label: 'Halfway there', at: half });
        out.push({ label: 'Debt-free', at: plan.plan.months });
        return out;
    }, [plan]);

    // What-ifs: considering loans + a refinance, compared with the current plan.
    const whatIf = useMemo(() => {
        const apr = parseFloat(refiApr);
        const refi = !!refiId && refiApr !== '' && apr >= 0;
        if (includeIds.length === 0 && !refi) return null;
        let loans = [...activeLoans, ...consideringLoans.filter(l => includeIds.includes(l.id)).map(l => ({ ...l, status: 'active' as const }))];
        if (refi) loans = loans.map(l => (l.id === refiId ? { ...l, apr } : l));
        return simulatePayoff(loans, plan.extra, plan.strategy, plan.customOrder);
    }, [activeLoans, consideringLoans, includeIds, refiId, refiApr, plan]);

    const moveCustom = (id: string, dir: -1 | 1) => {
        const order = plan.plan.order.slice();
        const i = order.indexOf(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= order.length) return;
        [order[i], order[j]] = [order[j], order[i]];
        setSettings(p => ({ ...p, customOrder: order }));
    };

    if (activeLoans.length === 0) {
        return (
            <Screen narrow>
                <PageTitle>Plan</PageTitle>
                <Card gap="lg">
                    <Text color="textMuted">Add a debt to see how an extra payment changes your payoff date.</Text>
                    <Link href="/debts?add=1" asChild><Button size="lg">+ Add a debt</Button></Link>
                </Card>
            </Screen>
        );
    }

    const interestDelta = plan.interestSaved;
    const multi = activeLoans.length > 1;
    const savings = [plan.monthsSaved > 0 ? `${formatDuration(plan.monthsSaved)} sooner` : null, interestDelta >= 1 ? `about ${money(roundTo(interestDelta, 10))} less interest` : null].filter(Boolean).join(' and ');

    return (
        <Screen>
            <PageTitle>Plan</PageTitle>
            <Grid min={360}>
                <Stack gap="lg">
                    <Stack gap="sm">
                        <SegTabs label="Payoff method" value={plan.strategy} options={STRATEGIES} onChange={v => setSettings(p => ({ ...p, strategy: v }))} />
                        <Text variant="caption" color="textMuted">{BLURB[plan.strategy]}</Text>
                    </Stack>

                    <Card gap="md">
                        <Text variant="label" color="textMuted">Extra each month</Text>
                        <Stepper label="extra payment" value={extra} step={25} min={0} max={Math.max(cap, extra)} onChange={setExtra} format={money} />
                        <Slider label="Extra payment per month" value={Math.min(extra, cap)} min={0} max={cap} step={25} onChange={setExtra} valueText={`${money(extra)} extra per month`} />
                        <Inline justify="space-between"><Text variant="caption" color="textMuted">{money(0)}</Text><Text variant="caption" color="accent">Available for debt payoff: {money(available)}/mo</Text></Inline>
                        <Inline wrap gap="sm">
                            {[50, 100, 250, 500].filter(v => v < available).map(v => <Chip key={v} active={extra === v} onPress={() => setExtra(v)}>{money(v)}</Chip>)}
                            {available > 0 ? <Chip active={extra === available} onPress={() => setExtra(available)}>{`Use all available · ${money(available)}`}</Chip> : null}
                            <Chip active={extra === 0} onPress={() => setExtra(0)}>None</Chip>
                        </Inline>
                        <Inline justify="space-between">
                            <Text variant="small" color="textMuted">Left after your extra</Text>
                            <Text variant="smallStrong" color={monthlyLeftoverMoney - extra < 0 ? 'risk' : 'text'}>{money(monthlyLeftoverMoney - extra)}/mo</Text>
                        </Inline>
                        {extra > available ? <Text variant="caption" color="amber">That’s more than the {money(available)} you have available after bills and minimums.</Text> : null}
                    </Card>

                    <Card gap="md">
                        <Inline justify="space-between"><Text variant="h3">Monthly payment</Text><Text variant="stat">{money(plan.plan.totalMinimum + extra)}</Text></Inline>
                        <SegTabs label="Payment breakdown" value={payView} options={[{ value: 'total', label: 'Minimum + extra' }, { value: 'debt', label: 'By debt' }]} onChange={setPayView} />
                        <StackedBar label="How your monthly debt payment is made up" segments={paySegments} />
                        <Stack gap="sm">
                            {paySegments.map(seg => (
                                <Inline key={seg.key} justify="space-between" gap="md">
                                    <Inline gap="sm" style={{ flex: 1 }}><Dot color={seg.color} /><Text variant="small" numberOfLines={1} style={{ flex: 1 }}>{seg.label}</Text></Inline>
                                    <Text variant="smallStrong">{money(seg.amount)}</Text>
                                </Inline>
                            ))}
                        </Stack>
                        {extra > 0 && plan.plan.order[0] ? <Text variant="caption" color="textMuted">Your extra goes to {names.get(plan.plan.order[0])}, then rolls to the next debt as each one is paid off.</Text> : null}
                    </Card>

                    {isGuest && !isSample && extra > 0 ? (
                        <Card tone="mint" gap="sm">
                            <Text variant="small">Sign in to save this plan and sync it across devices.</Text>
                            <Button compact onPress={() => openAuth('signup')}>Sign in</Button>
                        </Card>
                    ) : null}

                    <Section title={`Payoff order · ${plan.strategy === 'avalanche' ? 'highest APR first' : plan.strategy === 'snowball' ? 'smallest balance first' : 'your order'}`}>
                        <Card gap="md">
                            {plan.plan.order.map((id, i) => {
                                const l = activeLoans.find(x => x.id === id)!;
                                return (
                                    <Inline key={id} gap="md">
                                        <Avatar letter={String(i + 1)} size={28} />
                                        <Text style={{ flex: 1 }} numberOfLines={1}>{names.get(id)}</Text>
                                        <Text variant="label" color="amber">{l.apr.toFixed(1)}%</Text>
                                        <Text variant="body" style={{ minWidth: 72, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{money(l.balance)}</Text>
                                        {plan.strategy === 'custom' && multi ? (
                                            <Inline gap="xs">
                                                <TextButton color={i === 0 ? 'textMuted' : 'accent'} onPress={() => moveCustom(id, -1)}>↑</TextButton>
                                                <TextButton color={i === plan.plan.order.length - 1 ? 'textMuted' : 'accent'} onPress={() => moveCustom(id, 1)}>↓</TextButton>
                                            </Inline>
                                        ) : null}
                                    </Inline>
                                );
                            })}
                            {multi ? <Text variant="caption" color="textMuted">Paid off: {plan.plan.order.map(id => `${names.get(id)} ${plan.plan.payoffMonth[id] ? formatMonthYear(addMonths(plan.plan.payoffMonth[id])) : '—'}`).join(' · ')}</Text> : null}
                        </Card>
                    </Section>
                </Stack>

                <Stack gap="lg">
                    <Card gap="md">
                        <Legend items={[{ label: 'Minimums only', color: colors.textMuted }, { label: `With ${money(extra)} extra`, color: colors.accent }]} />
                        <Chart height={170} label="Balance with and without the extra payment" xLabels={[formatMonthYear(addMonths(0)), formatMonthYear(addMonths(horizon))]}
                            series={[{ data: compare.min, color: colors.textMuted, width: 2.5 }, { data: compare.withExtra, color: colors.accent }]} />
                        <Inline justify="space-between"><Text variant="small">Debt-free</Text><Text variant="smallStrong">{extra > 0 && plan.monthsSaved > 0 ? `${payoffLabel(plan.baseline)} → ` : ''}{payoffLabel(plan.plan)}</Text></Inline>
                        <Inline justify="space-between"><Text variant="small">Total interest</Text><Text variant="smallStrong">{extra > 0 && interestDelta >= 1 ? `${money(plan.baseline.totalInterest)} → ` : ''}{money(plan.plan.totalInterest)}</Text></Inline>
                        {extra > 0 && savings ? <Text variant="smallStrong" color="accent">{savings}.</Text> : null}
                        {plan.plan.neverPaysOff ? <Text variant="small" color="risk">At these payments the balance never reaches zero. Raise the extra or check your APRs.</Text> : null}
                        {milestones.length > 0 ? (
                            <Inline wrap gap="sm">{milestones.map(m => <Badge key={m.label} tone="mint">{`★ ${m.label} · ${formatMonthYear(addMonths(m.at))}`}</Badge>)}</Inline>
                        ) : null}
                    </Card>

                    {multi && !plan.plan.neverPaysOff ? (
                        <Section title="Balance by debt">
                            <Card gap="md">
                                <Chart stacked height={170} label="Stacked balance by debt over time" series={stacked} />
                                <Legend items={plan.plan.order.map((id, k) => ({ label: names.get(id) ?? id, color: colors.series[k % colors.series.length] }))} />
                            </Card>
                        </Section>
                    ) : null}

                    <Section title="Aim for a date">
                        <Card gap="md">
                            <Inline><Field label="Debt-free by (YYYY-MM)" value={target} onChange={v => { setTarget(v); setSettings(p => ({ ...p, targetDate: v || undefined })); }} placeholder="e.g. 2028-06" keyboardType="numbers-and-punctuation" /></Inline>
                            {target && targetMonths <= 0 ? <Text variant="small" color="amber">Pick a future month (YYYY-MM).</Text> : null}
                            {target && targetMonths > 0 && needed === null ? <Text variant="small" color="risk">That date isn’t reachable with these debts.</Text> : null}
                            {target && targetMonths > 0 && typeof needed === 'number' ? (
                                <Inline justify="space-between" gap="md">
                                    <Text variant="small" style={{ flex: 1 }}>{needed === 0 ? 'You’re already on track for that date.' : `You’d need ${money(needed)} extra each month.`}</Text>
                                    {needed > 0 ? <Button variant="secondary" compact onPress={() => setExtra(needed)}>Use this</Button> : null}
                                </Inline>
                            ) : null}
                        </Card>
                    </Section>

                    <Section title="What if…">
                        <Card gap="md">
                            {consideringLoans.length === 0 ? <Text variant="small" color="textMuted">Add a loan you’re considering with <Link href="/debts/test"><Text variant="smallStrong" color="accent">Test a new loan</Text></Link> to compare it here.</Text> : null}
                            {consideringLoans.map(l => (
                                <Inline key={l.id} gap="md" justify="space-between">
                                    <Text variant="small" style={{ flex: 1 }}>{l.name} · {money(l.balance)} at {l.apr}%</Text>
                                    <Chip active={includeIds.includes(l.id)} onPress={() => setIncludeIds(ids => (ids.includes(l.id) ? ids.filter(x => x !== l.id) : [...ids, l.id]))}>{includeIds.includes(l.id) ? 'Included' : 'Include'}</Chip>
                                </Inline>
                            ))}
                            <Inline align="flex-end">
                                <Select label="Refinance a debt" value={refiId} options={activeLoans.map(l => ({ value: l.id, label: l.name }))} onChange={setRefiId} />
                                <Field label="New APR" suffix="%" numeric value={refiApr} onChange={setRefiApr} />
                            </Inline>
                            {whatIf ? (
                                <Card tone="mint" gap="sm">
                                    <Inline justify="space-between"><Text variant="small">Debt-free</Text><Text variant="smallStrong">{payoffLabel(plan.plan)} → {payoffLabel(whatIf)}</Text></Inline>
                                    <Inline justify="space-between"><Text variant="small">Total interest</Text><Text variant="smallStrong">{money(plan.plan.totalInterest)} → {money(whatIf.totalInterest)}</Text></Inline>
                                </Card>
                            ) : null}
                        </Card>
                    </Section>
                </Stack>
            </Grid>
        </Screen>
    );
};

export default PlanScreen;
