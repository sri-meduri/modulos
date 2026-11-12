import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { colors } from '../theme';
import { useFinance } from '../contexts/FinanceContext';
import { elapsedLabel, groupAssets, netWorthTimeline, retirementPerformance, snapshotLabel, snapshots, spanOf } from '../services/assets';
import { projectRetirement, RETURN_PRESETS } from '../services/retirement';
import { Asset, AssetType } from '../types';
import { compactMoney, money, pct, toNumber } from '../lib/format';
import { Badge, Button, Card, Chart, checkpoints, Chip, Dot, Field, Grid, Icon, Inline, PageTitle, Row, Screen, Section, Select, Stack, StackedBar, Text } from '../components/ui';
import BankGate from '../components/BankGate';

const TYPES = Object.values(AssetType).map(t => ({ value: t, label: t }));
const TYPE_COLOR: Record<string, string> = Object.fromEntries(Object.values(AssetType).map((t, i) => [t, colors.series[i % colors.series.length]]));

/** Thin a long daily series to about 60 points so it stays smooth and quick to draw. */
const thin = <T,>(items: T[], max = 60): T[] => {
    if (items.length <= max) return items;
    const stride = Math.ceil(items.length / max);
    const out = items.filter((_, i) => i % stride === 0);
    if (out[out.length - 1] !== items[items.length - 1]) out.push(items[items.length - 1]);
    return out;
};

/** A line/area chart of one value per day with a $ axis and a few labelled checkpoints. */
const TimeLine: React.FC<{ points: { date: string; value: number }[]; label: string }> = ({ points, label }) => {
    const pts = thin(points);
    const span = spanOf(pts.map(p => p.date));
    return <Chart height={180} label={label} xTicks={checkpoints(pts.map(p => snapshotLabel(p.date, span)), 4)} series={[{ data: pts.map(p => p.value), color: colors.accent, fill: true }]} />;
};

/** Last `n` days ending today, oldest first, as YYYY-MM-DD (used for the locked previews). */
const lastDays = (n: number): string[] => Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

const AssetsScreen: React.FC = () => {
    const { finances, setFinances, totalAssets, totalDebt, netWorth, bankLinked } = useFinance();
    const assets = finances.assets ?? [];
    const groups = useMemo(() => groupAssets(assets), [assets]);
    const timeline = useMemo(() => netWorthTimeline(finances), [finances]);
    const perf = useMemo(() => retirementPerformance(finances), [finances]);
    const retirementLinked = assets.filter(a => a.plaidItemId && a.type === AssetType.Retirement);
    const retirementHistory = snapshots(finances).filter(h => h.retirement > 0);
    const setAsset = (id: string, patch: Partial<Asset>) => setFinances(prev => ({ ...prev, assets: (prev.assets ?? []).map(a => (a.id === id ? { ...a, ...patch } : a)) }));

    // Retirement predictor: starts from what the user already has, every field editable.
    const retirementNow = assets.filter(a => a.type === AssetType.Retirement).reduce((a, x) => a + x.value, 0);
    const contributionNow = Math.round((finances.monthly401kContribution ?? 0) + (finances.annualIraContribution ?? 0) / 12);
    const [balanceText, setBalanceText] = useState<string | null>(null);
    const [contribText, setContribText] = useState<string | null>(null);
    const [yearsText, setYearsText] = useState('30');
    const [returnPct, setReturnPct] = useState<number>(7);
    const proj = useMemo(() => projectRetirement({
        balance: balanceText === null ? retirementNow : toNumber(balanceText),
        monthlyContribution: contribText === null ? contributionNow : toNumber(contribText),
        annualReturnPct: returnPct, years: Math.min(60, Math.max(1, Math.round(toNumber(yearsText) || 30))),
    }), [balanceText, contribText, yearsText, returnPct, retirementNow, contributionNow]);
    const years = proj.yearly.length - 1;

    // Illustrative previews for the locked charts (dimmed behind the overlay).
    const days = lastDays(60);
    const demoNet = days.map((date, i) => ({ date, value: Math.round(Math.max(1000, (netWorth || 50000) * (0.94 + (0.06 * i) / 59) + Math.sin(i / 3) * Math.abs(netWorth || 50000) * 0.008)) }));
    const demoRetire = days.map((date, i) => ({ date, value: Math.round((retirementNow || 60000) * (0.96 + (0.04 * i) / 59) + Math.sin(i / 4) * 900) }));

    return (
        <Screen>
            <PageTitle>Assets</PageTitle>

            <Grid min={340}>
                <Stack gap="lg">
                    <Card gap="md" pad="roomy">
                        <Text variant="label" color="textMuted">Net worth</Text>
                        <Text variant="hero" color={netWorth < 0 ? 'risk' : 'accent'}>{money(netWorth)}</Text>
                        <Stack gap="sm">
                            <Row label="Assets" value={<Text variant="bodyStrong">{money(totalAssets)}</Text>} />
                            <Row label="Debt" value={<Text variant="bodyStrong">{money(totalDebt)}</Text>} />
                        </Stack>
                    </Card>

                    <Section title="Net worth over time">
                        <Card gap="md">
                            <BankGate locked={!bankLinked} title="Net worth over time" benefit="See how your net worth rises and falls month by month, built from your real account balances."
                                preview={<TimeLine points={demoNet} label="Example net worth over time" />}>
                                {timeline.length >= 2
                                    ? <>
                                        <TimeLine points={timeline.map(t => ({ date: t.date, value: t.net }))} label="Net worth over time" />
                                        <Inline justify="space-between">
                                            <Text variant="small" color="textMuted">Since {snapshotLabel(timeline[0].date, 0)}, {elapsedLabel(spanOf(timeline.map(t => t.date)))} ago</Text>
                                            <Text variant="smallStrong" color={timeline[timeline.length - 1].net >= timeline[0].net ? 'accent' : 'risk'}>
                                                {`${timeline[timeline.length - 1].net >= timeline[0].net ? '+' : '−'}${money(Math.abs(timeline[timeline.length - 1].net - timeline[0].net))}`}
                                            </Text>
                                        </Inline>
                                    </>
                                    : <Text variant="small" color="textMuted">Your bank is connected and we’ve started tracking. We add a point every day, so the line appears tomorrow.</Text>}
                            </BankGate>
                        </Card>
                    </Section>

                    {groups.length > 0 ? (
                        <Section title="What you own">
                            <Card gap="md">
                                <StackedBar label="Your assets by type" height={18} segments={groups.map(g => ({ key: g.type, share: g.share, color: TYPE_COLOR[g.type], label: g.type, detail: money(g.total) }))} />
                                <Stack gap="sm">
                                    {groups.map(g => (
                                        <Inline key={g.type} justify="space-between" gap="md">
                                            <Inline gap="sm" style={{ flex: 1 }}><Dot color={TYPE_COLOR[g.type]} /><Text variant="small" style={{ flex: 1 }}>{g.type}{g.count > 1 ? ` · ${g.count}` : ''}</Text></Inline>
                                            <Text variant="small" color="textMuted">{pct(g.share)}</Text>
                                            <Text variant="smallStrong" style={{ minWidth: 84, textAlign: 'right' }}>{money(g.total)}</Text>
                                        </Inline>
                                    ))}
                                </Stack>
                            </Card>
                        </Section>
                    ) : null}
                </Stack>

                <Stack gap="lg">
                    <Section title="Retirement projection">
                        <Card gap="md">
                            <Text variant="small" color="textMuted">A simple estimate: your savings plus monthly contributions, growing at an average return. Edit any number.</Text>
                            <Inline align="flex-start">
                                <Field label="Saved today" prefix="$" numeric value={balanceText ?? (retirementNow ? String(Math.round(retirementNow)) : '')} placeholder="0" onChange={setBalanceText} />
                                <Field label="Added each month" prefix="$" numeric value={contribText ?? (contributionNow ? String(contributionNow) : '')} placeholder="0" onChange={setContribText} />
                            </Inline>
                            <Inline><Field label="Years until retirement" keyboardType="number-pad" maxLength={2} value={yearsText} onChange={setYearsText} /></Inline>
                            <Stack gap="sm">
                                <Text variant="label" color="textMuted">Average yearly return</Text>
                                <Inline wrap gap="sm">{RETURN_PRESETS.map(r => <Chip key={r.value} active={returnPct === r.value} onPress={() => setReturnPct(r.value)}>{r.label}</Chip>)}</Inline>
                            </Stack>
                            <Inline justify="space-between" align="baseline">
                                <Text variant="label" color="textMuted">In {years} {years === 1 ? 'year' : 'years'}</Text>
                                <Text variant="hero" color="accent">{compactMoney(proj.final)}</Text>
                            </Inline>
                            <Chart height={190} label="Projected retirement savings by year" xTicks={checkpoints(proj.yearly.map((_, i) => (i === 0 ? 'Today' : `${i} ${i === 1 ? 'year' : 'years'}`)), 4)} series={[{ data: proj.yearly, color: colors.accent, fill: true }]} />
                            <Stack gap="sm">
                                <Row label="Starting balance" value={money(balanceText === null ? retirementNow : toNumber(balanceText))} />
                                <Row label="You contribute" value={money(proj.contributed)} />
                                <Row label="Estimated growth" value={<Text variant="bodyStrong" color="accent">{money(Math.max(0, proj.growth))}</Text>} />
                            </Stack>
                            <Text variant="caption" color="textMuted">An illustration using a steady average return, not a guarantee. Real returns vary and can be negative, and these figures aren’t adjusted for inflation. Sign in and connect a bank to see your actual performance below.</Text>
                        </Card>
                    </Section>

                    <Section title="Your actual performance">
                        <Card gap="md">
                            <BankGate locked={!bankLinked || retirementLinked.length === 0} title="Actual retirement performance" benefit="Track how your real 401(k) or IRA balance has changed over time. Connect the bank that holds it."
                                preview={<TimeLine points={demoRetire} label="Example retirement balance over time" />}>
                                <Inline justify="space-between" align="baseline"><Text variant="label" color="textMuted">Linked retirement balance</Text><Text variant="stat">{money(retirementLinked.reduce((a, x) => a + x.value, 0))}</Text></Inline>
                                {perf ? (
                                    <>
                                        <Text variant="smallStrong" color={perf.change >= 0 ? 'accent' : 'risk'}>{`${perf.change >= 0 ? '+' : '−'}${money(Math.abs(perf.change))} (${perf.change >= 0 ? '+' : '−'}${pct(Math.abs(perf.percent), 1)}) over ${elapsedLabel(perf.days)}`}</Text>
                                        <TimeLine points={retirementHistory.map(h => ({ date: h.date, value: h.retirement }))} label="Retirement balance over time" />
                                        <Text variant="caption" color="textMuted">Balance changes include your contributions as well as market gains and losses.</Text>
                                    </>
                                ) : <Text variant="small" color="textMuted">We started tracking this balance today. The growth chart appears once we have a couple of days of data.</Text>}
                            </BankGate>
                        </Card>
                    </Section>
                </Stack>
            </Grid>

            <Section title="Your assets" right={<Text variant="small" color="textMuted">{money(totalAssets)}</Text>}>
                {assets.length === 0 ? <Card><Text variant="small" color="textMuted">Add savings, retirement accounts, a home or a car to see your net worth.</Text></Card> : null}
                <Grid min={340}>
                    {assets.map(a => (
                        <Card key={a.id} gap="sm">
                            <Inline justify="space-between" gap="sm">
                                <Stack style={{ flex: 1 }}><Field inline label="Asset name" value={a.name} onChange={v => setAsset(a.id, { name: v })} /></Stack>
                                {a.plaidItemId ? <Badge>From bank</Badge> : null}
                                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${a.name}`} hitSlop={10} onPress={() => setFinances(p => ({ ...p, assets: (p.assets ?? []).filter(x => x.id !== a.id) }))}><Icon name="close" size={20} color="textMuted" /></Pressable>
                            </Inline>
                            <Inline gap="sm">
                                <Select inline label="Asset type" value={a.type} options={TYPES} onChange={t => setAsset(a.id, { type: t })} />
                                <Field inline label={`${a.name} value`} prefix="$" numeric value={a.value} onChange={v => setAsset(a.id, { value: toNumber(v) })} />
                            </Inline>
                        </Card>
                    ))}
                </Grid>
                <Button variant="secondary" onPress={() => setFinances(p => ({ ...p, assets: [...(p.assets ?? []), { id: `asset-${Date.now()}`, name: 'New asset', type: AssetType.Cash, value: 0 }] }))}>+ Add an asset</Button>
            </Section>
        </Screen>
    );
};

export default AssetsScreen;
