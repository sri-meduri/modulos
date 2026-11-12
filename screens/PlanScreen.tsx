import React, { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { colors } from '../theme';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { PayoffStrategy } from '../types';
import { usePlan } from '../hooks/usePlan';
import { addMonths, extraForTarget, formatDuration, formatMonthYear, formatMonthYearLong, monthsBetweenNow, payoffLabel, simulatePayoff } from '../services/payoff';
import { getEffectiveMinPayment } from '../services/loanCalculator';
import { money, toNumber } from '../lib/format';
import { Badge, Button, Card, Chart, checkpoints, Chip, CheckMark, Dot, Field, Grid, Inline, Legend, PageTitle, Screen, Section, SegTabs, Select, Slider, Stack, StackedBar, Stepper, Text, TextButton } from '../components/ui';

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

/** Warn when less than this much (or this share of income) is left after the extra. */
const bufferFloor = (income: number) => Math.max(100, income * 0.03);

/** Samples a series to ~`points` entries so long payoffs stay readable. */
const sample = (n: number, points: number): number[] => {
    const stride = Math.max(1, Math.ceil(n / points));
    const out: number[] = [];
    for (let i = 0; i <= n; i += stride) out.push(i);
    if (out[out.length - 1] !== n) out.push(n);
    return out;
};

const PlanScreen: React.FC = () => {
    const { isGuest, isSample, openAuth } = useAuth();
    const { finances, settings, setSettings, activeLoans, consideringLoans, paidOffLoans, monthlyLeftoverMoney } = useFinance();
    const plan = usePlan();
    const [payView, setPayView] = useState<'total' | 'debt'>('total');
    const [whatIfKind, setWhatIfKind] = useState<'loan' | 'refi'>('loan');
    const [includeIds, setIncludeIds] = useState<string[]>([]);
    const [refiId, setRefiId] = useState('');
    const [refiApr, setRefiApr] = useState('');
    const [customText, setCustomText] = useState('');

    // Money available for debt payoff = what is left after bills and minimums. The extra can
    // never exceed it, so "Left after your extra" can never go negative.
    const available = Math.max(0, Math.floor(monthlyLeftoverMoney));
    const cap = Math.max(25, Math.floor(available / 25) * 25);
    const extra = Math.min(plan.extra, available);
    const overAvailable = plan.extra > available;
    const setExtra = (v: number) => setSettings(p => ({ ...p, extraPayment: Math.max(0, Math.min(available, Math.round(v))) }));
    const left = monthlyLeftoverMoney - extra;
    const tight = extra > 0 && left < bufferFloor(finances.monthlyNetIncome);
    const names = useMemo(() => new Map(finances.loans.map(l => [l.id, l.name])), [finances.loans]);

    const paySegments = useMemo(() => {
        const total = (plan.plan.totalMinimum + extra) || 1;
        const out: { key: string; label: string; amount: number; share: number; color: string }[] = [];
        if (payView === 'total') {
            out.push({ key: 'min', label: 'Minimum payments', amount: plan.plan.totalMinimum, share: plan.plan.totalMinimum / total, color: colors.series[2] });
        } else {
            plan.plan.order.forEach((id, k) => {
                const l = activeLoans.find(x => x.id === id);
                if (l) { const amt = getEffectiveMinPayment(l); out.push({ key: id, label: `${l.name} minimum`, amount: amt, share: amt / total, color: colors.series[(k + 2) % colors.series.length] }); }
            });
        }
        if (extra > 0) out.push({ key: 'extra', label: 'Extra payment', amount: extra, share: extra / total, color: colors.accent });
        return out;
    }, [activeLoans, plan, extra, payView]);

    // Before/after chart with a rounded balance axis and a few month checkpoints.
    const horizon = Math.max(plan.baseline.months, plan.plan.months);
    const compare = useMemo(() => {
        const idx = sample(horizon, 40);
        return {
            min: idx.map(i => plan.baseline.balanceSeries[Math.min(i, plan.baseline.months)] ?? 0),
            withExtra: idx.map(i => plan.plan.balanceSeries[Math.min(i, plan.plan.months)] ?? 0),
            ticks: checkpoints(idx.map(i => formatMonthYear(addMonths(i))), 4),
        };
    }, [plan, horizon]);

    // "Aim for a date": a month slider limited to what is actually reachable with the money available.
    const earliest = useMemo(() => Math.max(1, simulatePayoff(activeLoans, available, plan.strategy, plan.customOrder).months), [activeLoans, available, plan.strategy, plan.customOrder]);
    const latest = Math.max(earliest, plan.baseline.months);
    const savedTarget = settings.targetDate ? monthsBetweenNow(settings.targetDate) : 0;
    const [targetMonths, setTargetMonths] = useState(Math.min(latest, Math.max(earliest, savedTarget > 0 ? savedTarget : plan.plan.months)));
    const pickTarget = (m: number) => {
        setTargetMonths(m);
        const d = addMonths(m);
        setSettings(p => ({ ...p, targetDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }));
    };
    const neededRaw = useMemo(() => extraForTarget(activeLoans, targetMonths, plan.strategy, plan.customOrder, Math.max(available, 25)), [activeLoans, targetMonths, plan.strategy, plan.customOrder, available]);
    const needed = neededRaw === null ? null : Math.min(neededRaw, available);
    const targetLeft = needed === null ? null : monthlyLeftoverMoney - needed;

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

    // What if: one comparison against today's plan, either a loan you're considering or a refinance.
    const whatIf = useMemo(() => {
        let loans = [...activeLoans];
        if (whatIfKind === 'loan') {
            const picked = consideringLoans.filter(l => includeIds.includes(l.id));
            if (picked.length === 0) return null;
            loans = [...loans, ...picked.map(l => ({ ...l, status: 'active' as const }))];
        } else {
            const apr = parseFloat(refiApr);
            if (!refiId || refiApr === '' || !(apr >= 0)) return null;
            loans = loans.map(l => (l.id === refiId ? { ...l, apr } : l));
        }
        return simulatePayoff(loans, extra, plan.strategy, plan.customOrder);
    }, [activeLoans, consideringLoans, includeIds, whatIfKind, refiId, refiApr, extra, plan.strategy, plan.customOrder]);

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
    const savings = [plan.monthsSaved > 0 ? `${formatDuration(plan.monthsSaved)} sooner` : null, interestDelta >= 1 ? `about ${money(Math.round(interestDelta / 10) * 10)} less interest` : null].filter(Boolean).join(' and ');

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
                        <Stepper label="extra payment" value={extra} step={25} min={0} max={available} onChange={setExtra} format={money} />
                        <Slider label="Extra payment per month" value={Math.min(extra, cap)} min={0} max={cap} step={25} onChange={setExtra} valueText={`${money(extra)} extra per month`} />
                        <Inline justify="space-between"><Text variant="caption" color="textMuted">{money(0)}</Text><Text variant="caption" color="accent">Available for debt payoff: {money(available)}/mo</Text></Inline>
                        <Inline align="flex-end" gap="md">
                            <Field label="Or type an amount" prefix="$" numeric value={customText} placeholder={String(extra)} onChange={v => { setCustomText(v); if (v !== '') setExtra(toNumber(v)); }} hint={toNumber(customText) > available ? `Capped at ${money(available)}, what you have available.` : undefined} />
                        </Inline>
                        <Inline wrap gap="sm">
                            {[50, 100, 250, 500].filter(v => v < available).map(v => <Chip key={v} active={extra === v} onPress={() => { setCustomText(''); setExtra(v); }}>{money(v)}</Chip>)}
                            {available > 0 ? <Chip active={extra === available} onPress={() => { setCustomText(''); setExtra(available); }}>{`Use all available · ${money(available)}`}</Chip> : null}
                            <Chip active={extra === 0} onPress={() => { setCustomText(''); setExtra(0); }}>None</Chip>
                        </Inline>
                        <Inline justify="space-between">
                            <Text variant="small" color="textMuted">Left after your extra</Text>
                            <Text variant="smallStrong" color={tight ? 'amber' : 'text'}>{money(left)}/mo</Text>
                        </Inline>
                        {tight ? <Text variant="caption" color="amber">That leaves only {money(left)} a month as a cushion for surprises.</Text> : null}
                        {overAvailable ? <Text variant="caption" color="amber">Your saved extra was more than you have available now, so it's capped at {money(available)}.</Text> : null}
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

                    <Section title={`Payoff checklist · ${plan.strategy === 'avalanche' ? 'highest APR first' : plan.strategy === 'snowball' ? 'smallest balance first' : 'your order'}`}>
                        <Card gap="md">
                            {plan.plan.order.map((id, i) => {
                                const l = activeLoans.find(x => x.id === id)!;
                                const month = plan.plan.payoffMonth[id];
                                return (
                                    <Inline key={id} gap="md">
                                        <CheckMark checked={false} />
                                        <Stack gap="xs" style={{ flex: 1 }}>
                                            <Text variant={i === 0 ? 'bodyStrong' : 'body'} numberOfLines={1}>{l.name}</Text>
                                            <Text variant="caption" color="textMuted">{month ? `Paid off ${formatMonthYearLong(addMonths(month))}` : 'Payoff date unavailable'} · {l.apr.toFixed(1)}% APR</Text>
                                        </Stack>
                                        <Text variant="smallStrong">{money(l.balance)}</Text>
                                        {plan.strategy === 'custom' && multi ? (
                                            <Inline gap="xs">
                                                <TextButton color={i === 0 ? 'textMuted' : 'accent'} onPress={() => moveCustom(id, -1)}>↑</TextButton>
                                                <TextButton color={i === plan.plan.order.length - 1 ? 'textMuted' : 'accent'} onPress={() => moveCustom(id, 1)}>↓</TextButton>
                                            </Inline>
                                        ) : null}
                                    </Inline>
                                );
                            })}
                            {paidOffLoans.map(l => (
                                <Inline key={l.id} gap="md">
                                    <CheckMark checked />
                                    <Stack gap="xs" style={{ flex: 1 }}>
                                        <Text color="textMuted" style={{ textDecorationLine: 'line-through' }} numberOfLines={1}>{l.name}</Text>
                                        <Text variant="caption" color="accent">Paid off</Text>
                                    </Stack>
                                </Inline>
                            ))}
                        </Card>
                    </Section>
                </Stack>

                <Stack gap="lg">
                    <Card gap="md">
                        <Legend items={[{ label: 'Minimums only', color: colors.textMuted }, { label: `With ${money(extra)} extra`, color: colors.accent }]} />
                        <Chart height={200} label="Balance with and without the extra payment" xTicks={compare.ticks}
                            series={[{ data: compare.min, color: colors.textMuted, width: 2.5 }, { data: compare.withExtra, color: colors.accent }]} />
                        <Inline justify="space-between"><Text variant="small">Debt-free</Text><Text variant="smallStrong">{extra > 0 && plan.monthsSaved > 0 ? `${payoffLabel(plan.baseline)} → ` : ''}{payoffLabel(plan.plan)}</Text></Inline>
                        <Inline justify="space-between"><Text variant="small">Total interest</Text><Text variant="smallStrong">{extra > 0 && interestDelta >= 1 ? `${money(plan.baseline.totalInterest)} → ` : ''}{money(plan.plan.totalInterest)}</Text></Inline>
                        {extra > 0 && savings ? <Text variant="smallStrong" color="accent">{savings}.</Text> : null}
                        {plan.plan.neverPaysOff ? <Text variant="small" color="risk">At these payments the balance never reaches zero. Raise the extra or check your APRs.</Text> : null}
                        {milestones.length > 0 ? (
                            <Inline wrap gap="sm">{milestones.map(m => <Badge key={m.label} tone="mint">{`★ ${m.label} · ${formatMonthYear(addMonths(m.at))}`}</Badge>)}</Inline>
                        ) : null}
                    </Card>

                    {latest > earliest ? (
                        <Section title="Aim for a date">
                            <Card gap="md">
                                <Inline justify="space-between" align="baseline">
                                    <Text variant="label" color="textMuted">Debt-free by</Text>
                                    <Text variant="stat">{formatMonthYearLong(addMonths(targetMonths))}</Text>
                                </Inline>
                                <Slider label="Target debt-free month" value={targetMonths} min={earliest} max={latest} step={1} onChange={pickTarget} valueText={formatMonthYearLong(addMonths(targetMonths))} />
                                <Inline justify="space-between"><Text variant="caption" color="textMuted">{formatMonthYearLong(addMonths(earliest))}</Text><Text variant="caption" color="textMuted">{formatMonthYearLong(addMonths(latest))}</Text></Inline>
                                {needed === null ? <Text variant="small" color="risk">That date isn’t reachable with the money you have available.</Text> : (
                                    <Inline justify="space-between" gap="md">
                                        <Text variant="small" style={{ flex: 1 }}>{needed === 0 ? 'You’re already on track for this date.' : `Needs ${money(needed)} extra a month.`}</Text>
                                        {needed > 0 && needed !== extra ? <Button variant="secondary" compact onPress={() => { setCustomText(''); setExtra(needed); }}>Use this</Button> : null}
                                    </Inline>
                                )}
                                {needed !== null && targetLeft !== null && targetLeft < bufferFloor(finances.monthlyNetIncome) && needed > 0 ? <Text variant="caption" color="amber">This leaves only {money(targetLeft)} a month spare.</Text> : null}
                                <Text variant="caption" color="textMuted">The earliest possible date uses all {money(available)} you have available each month.</Text>
                            </Card>
                        </Section>
                    ) : null}

                    <Section title="What if…">
                        <Card gap="md">
                            <SegTabs label="What-if type" value={whatIfKind} options={[{ value: 'loan', label: 'I take a new loan' }, { value: 'refi', label: 'I refinance' }]} onChange={setWhatIfKind} />
                            {whatIfKind === 'loan' ? (
                                consideringLoans.length === 0 ? (
                                    <Text variant="small" color="textMuted">See how a loan you’re thinking about changes your payoff date. Check one with <Link href="/debts/test"><Text variant="smallStrong" color="accent">Test a new loan</Text></Link> and add it as a what-if.</Text>
                                ) : (
                                    <Stack gap="sm">
                                        <Text variant="small" color="textMuted">Tap the loans to include in the comparison.</Text>
                                        {consideringLoans.map(l => (
                                            <Inline key={l.id} gap="md" justify="space-between">
                                                <Text variant="small" style={{ flex: 1 }}>{l.name} · {money(l.balance)} at {l.apr}%</Text>
                                                <Chip active={includeIds.includes(l.id)} onPress={() => setIncludeIds(ids => (ids.includes(l.id) ? ids.filter(x => x !== l.id) : [...ids, l.id]))}>{includeIds.includes(l.id) ? 'Included' : 'Include'}</Chip>
                                            </Inline>
                                        ))}
                                    </Stack>
                                )
                            ) : (
                                <Stack gap="sm">
                                    <Text variant="small" color="textMuted">See the effect of getting a lower rate on one of your debts.</Text>
                                    <Inline align="flex-end">
                                        <Select label="Which debt" value={refiId} options={activeLoans.map(l => ({ value: l.id, label: l.name }))} onChange={setRefiId} />
                                        <Field label="New APR" suffix="%" numeric value={refiApr} onChange={setRefiApr} />
                                    </Inline>
                                </Stack>
                            )}
                            {whatIf ? (
                                <Card tone="mint" gap="sm">
                                    <Text variant="captionStrong" color="accent">WITH THIS CHANGE</Text>
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
