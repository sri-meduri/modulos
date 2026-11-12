import React, { useMemo } from 'react';
import { Pressable } from 'react-native';
import { colors } from '../theme';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useBanks } from '../hooks/useBanks';
import { groupAssets, retirementPerformance } from '../services/assets';
import { formatMonthYear } from '../services/payoff';
import { Asset, AssetType } from '../types';
import { money, pct, toNumber } from '../lib/format';
import { Badge, Button, Card, Chart, checkpoints, Dot, Field, Grid, Icon, Inline, PageTitle, Row, Screen, Section, Select, Stack, StackedBar, Text } from '../components/ui';
import PlaidLinkButton from '../components/PlaidLinkButton';

const TYPES = Object.values(AssetType).map(t => ({ value: t, label: t }));
const TYPE_COLOR: Record<string, string> = Object.fromEntries(Object.values(AssetType).map((t, i) => [t, colors.series[i % colors.series.length]]));

const AssetsScreen: React.FC = () => {
    const { isSample } = useAuth();
    const { finances, setFinances, totalAssets, totalDebt, netWorth, bankLinked } = useFinance();
    const { banks, loaded } = useBanks();
    const assets = finances.assets ?? [];
    const groups = useMemo(() => groupAssets(assets), [assets]);
    const perf = useMemo(() => retirementPerformance(finances), [finances]);
    const retirementLinked = assets.filter(a => a.plaidItemId && a.type === AssetType.Retirement);
    const retirementTotal = retirementLinked.reduce((a, x) => a + x.value, 0);
    const history = (finances.assetHistory ?? []).filter(h => h.retirement > 0);
    const setAsset = (id: string, patch: Partial<Asset>) => setFinances(prev => ({ ...prev, assets: (prev.assets ?? []).map(a => (a.id === id ? { ...a, ...patch } : a)) }));

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

                    {groups.length > 0 ? (
                        <Section title="What you own">
                            <Card gap="md">
                                <StackedBar label="Your assets by type" height={18} segments={groups.map(g => ({ key: g.type, share: g.share, color: TYPE_COLOR[g.type] }))} />
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

                    <Section title="Retirement performance">
                        {bankLinked && retirementLinked.length > 0 ? (
                            <Card gap="md">
                                <Inline justify="space-between" align="baseline"><Text variant="label" color="textMuted">Linked retirement balance</Text><Text variant="stat">{money(retirementTotal)}</Text></Inline>
                                {perf ? (
                                    <>
                                        <Text variant="smallStrong" color={perf.change >= 0 ? 'accent' : 'risk'}>{`${perf.change >= 0 ? '+' : '−'}${money(Math.abs(perf.change))} (${perf.change >= 0 ? '+' : '−'}${pct(Math.abs(perf.percent), 1)}) over ${perf.months} month${perf.months === 1 ? '' : 's'}`}</Text>
                                        <Chart height={170} label="Retirement balance by month" xTicks={checkpoints(history.map(h => { const [y, m] = h.month.split('-').map(Number); return formatMonthYear(new Date(y, m - 1, 1)); }), 4)} series={[{ data: history.map(h => h.retirement), color: colors.accent, fill: true }]} />
                                        <Text variant="caption" color="textMuted">Balance changes include your contributions as well as market gains and losses.</Text>
                                    </>
                                ) : <Text variant="small" color="textMuted">We started tracking this balance today. The growth chart appears after your next monthly sync, since your bank gives us today’s balance and we record it each month.</Text>}
                            </Card>
                        ) : (
                            <Card tone="outline" gap="sm">
                                <Text variant="small" color="textMuted">Connect a bank with your 401(k) or IRA to track its balance and growth over time. Performance comes from your real balances, so it isn’t available for amounts typed in by hand.</Text>
                                {loaded && !isSample && banks.length === 0 ? <PlaidLinkButton size="md" variant="secondary" /> : null}
                            </Card>
                        )}
                    </Section>
                </Stack>

                <Section title="Your assets" right={<Text variant="small" color="textMuted">{money(totalAssets)}</Text>}>
                    {assets.length === 0 ? <Card><Text variant="small" color="textMuted">Add savings, retirement accounts, a home or a car to see your net worth.</Text></Card> : null}
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
                    <Button variant="secondary" onPress={() => setFinances(p => ({ ...p, assets: [...(p.assets ?? []), { id: `asset-${Date.now()}`, name: 'New asset', type: AssetType.Cash, value: 0 }] }))}>+ Add an asset</Button>
                </Section>
            </Grid>
        </Screen>
    );
};

export default AssetsScreen;
