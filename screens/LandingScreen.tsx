import React, { useMemo, useRef, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, IconName, space, useSize } from '../theme';
import { simulatePayoff, addMonths, formatMonthYear, formatDuration } from '../services/payoff';
import { Loan, LoanType } from '../types';
import { money } from '../lib/format';
import { openUrl } from '../lib/links';
import { Band, Button, Card, Chart, Grid, Icon, Inline, Slider, Stack, Text, TextButton } from '../components/ui';

const logo = require('../assets/logo.png');

interface Props { onSignIn: () => void; onSignUp: () => void; onTrySample: () => void }

const DEMO_LOANS: Loan[] = [
    { id: '1', name: 'Credit Card', type: LoanType.CreditCard, balance: 8500, apr: 22.99, term: 5, originalAmount: 10000 },
    { id: '2', name: 'Auto Loan', type: LoanType.Auto, balance: 11200, apr: 7.5, term: 5, originalAmount: 15000 },
    { id: '3', name: 'Student Loan', type: LoanType.Student, balance: 18500, apr: 5.05, term: 10, originalAmount: 25000 },
];
const MAX_EXTRA = 600;

const QUESTIONS: { icon: IconName; text: string }[] = [
    { icon: 'dollar', text: '“Can I really afford this payment?”' },
    { icon: 'spark', text: '“Will this loan hurt my future?”' },
    { icon: 'alert', text: '“Why am I still stuck in debt?”' },
];
const STEPS = [
    { title: 'Add your debts and income', desc: 'Connect a bank or type it in. Your debt-free date appears in under 2 minutes.' },
    { title: 'Test a loan before you borrow', desc: 'See your debt-to-income ratio and whether a new loan is Safe, Borderline or Not Recommended, and what it does to your payoff date.' },
    { title: 'Build a smarter payoff plan', desc: 'Avalanche targets the highest APR, Snowball the smallest balance. Compare them and see the interest you save.' },
];
const FEATURES: { icon: IconName; title: string; points: string[] }[] = [
    { icon: 'shield', title: 'Smart Loan Checker', points: ['Calculates debt-to-income instantly', 'Cautious, balanced or flexible limits', 'Safe / Borderline / Not Recommended, with ways to make it safer'] },
    { icon: 'chart', title: 'Payoff Planner', points: ['Avalanche, Snowball or your own order', 'Projected payoff date and interest saved', 'Extra-payment slider and target dates'] },
    { icon: 'progress', title: 'Progress Tracking', points: ['Log payments, or let your bank detect them', 'Milestones and a real balance history', 'Monthly leftover money at a glance'] },
];
const AUDIENCE = ['Adults managing multiple loans', 'People considering a mortgage, auto, or student loan', 'Anyone who wants to get out of debt faster', 'Individuals who prefer privacy and control'];
const COMPARE = [
    ['Require bank login', 'Optional — connect or enter manually'],
    ['Push refinancing products', 'No upsells, ever'],
    ['Complex dashboards', 'Simple, guided flow'],
];

const LandingScreen: React.FC<Props> = ({ onSignIn, onSignUp, onTrySample }) => {
    const router = useRouter();
    const { isWide } = useSize();
    const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const howY = useRef(0);
    const [extra, setExtra] = useState(0);

    const demo = useMemo(() => ({ base: simulatePayoff(DEMO_LOANS, 0), plan: simulatePayoff(DEMO_LOANS, extra) }), [extra]);
    const timeSaved = demo.base.months - demo.plan.months;
    const interestSaved = demo.base.totalInterest - demo.plan.totalInterest;
    const series = useMemo(() => {
        const n = demo.plan.months;
        const stride = Math.max(1, Math.ceil(n / 30));
        const data: number[] = [];
        for (let i = 0; i <= n; i += stride) data.push(demo.plan.balanceSeries[i] ?? 0);
        return data;
    }, [demo.plan]);

    return (
        <ScrollView ref={scroller} style={{ flex: 1, backgroundColor: colors.bg }}>
            <Band gap="huge">
                <Inline justify="space-between">
                    <Inline gap="sm"><Image source={logo} style={{ width: 55, height: 40 }} resizeMode="contain" accessibilityIgnoresInvertColors /><Text variant="h3" color="accent">Modulos</Text></Inline>
                    <Inline gap="sm"><Button variant="secondary" compact onPress={onSignIn}>Sign in</Button><Button compact onPress={onSignUp}>Sign up</Button></Inline>
                </Inline>

                <View style={{ flexDirection: isWide ? 'row' : 'column', gap: space.giant, alignItems: isWide ? 'center' : 'stretch' }}>
                    <Stack gap="xl" style={{ flex: 1 }}>
                        <Text variant="captionStrong" color="accent" style={{ letterSpacing: 1.5 }}>MODULOS: YOUR PERSONAL DEBT MANAGEMENT COMPANION</Text>
                        <View>
                            <Text variant="display" accessibilityRole="header">Take Control</Text>
                            <Text variant="display">of <Text variant="display" color="accent">Your Loans.</Text></Text>
                        </View>
                        <Text variant="body" color="textMuted">Instantly see if a loan is affordable and build a smart payoff plan. Bank connection optional.</Text>
                        <Stack gap="md">
                            <Button size="lg" onPress={onSignUp}>Get started — free</Button>
                            <Button size="lg" variant="secondary" onPress={onTrySample}>Try a sample</Button>
                            <TextButton color="textMuted" onPress={() => scroller.current?.scrollTo({ y: howY.current, animated: true })}>See how it works ↓</TextButton>
                        </Stack>
                    </Stack>
                    <View style={{ flex: 1 }}>
                        <Card gap="lg" pad="roomy">
                            <Text variant="captionStrong" color="accent">LIVE DEMO</Text>
                            <Text variant="h2">Interactive payoff timeline</Text>
                            <Inline gap="md" align="stretch">
                                <Stat label="Payoff date" value={formatMonthYear(addMonths(demo.plan.months))} />
                                <Stat label="Time saved" value={timeSaved > 0 ? formatDuration(timeSaved) : '—'} />
                                <Stat label="Interest saved" value={interestSaved >= 1 ? money(interestSaved) : '—'} />
                            </Inline>
                            <Stack gap="xs">
                                <Inline justify="space-between"><Text variant="label" color="textMuted">Extra monthly payment</Text><Text variant="smallStrong" color="accent">{money(extra)}</Text></Inline>
                                <Slider label="Extra monthly payment" value={extra} min={0} max={MAX_EXTRA} step={25} onChange={setExtra} valueText={money(extra)} />
                            </Stack>
                            <Chart height={140} series={[{ data: series, color: colors.accent, fill: true }]} label="Demo debt balance over time" />
                        </Card>
                    </View>
                </View>
            </Band>

            <Band alt>
                <Text variant="h1" align="center" accessibilityRole="header">Most people don’t know if a loan is actually affordable</Text>
                <Grid min={240}>
                    {QUESTIONS.map(q => (
                        <Card key={q.text} gap="md" style={{ alignItems: 'center' }} pad="roomy">
                            <Icon name={q.icon} size={32} color="accent" />
                            <Text variant="h3" align="center">{q.text}</Text>
                        </Card>
                    ))}
                </Grid>
            </Band>

            <View onLayout={e => { howY.current = e.nativeEvent.layout.y; }}>
                <Band>
                    <Text variant="h1" align="center" accessibilityRole="header">Simple. Fast. Powerful.</Text>
                    <Grid min={260}>
                        {STEPS.map((s, i) => (
                            <Card key={s.title} gap="md" pad="roomy">
                                <Text variant="stat" color="accent">{`0${i + 1}`}</Text>
                                <Text variant="h3">{s.title}</Text>
                                <Text variant="small" color="textMuted">{s.desc}</Text>
                            </Card>
                        ))}
                    </Grid>
                </Band>
            </View>

            <Band alt>
                <Text variant="h1" align="center" accessibilityRole="header">Everything you need to make smarter financial decisions</Text>
                <Grid min={260}>
                    {FEATURES.map(f => (
                        <Card key={f.title} gap="md" pad="roomy">
                            <Icon name={f.icon} size={28} color="accent" />
                            <Text variant="h3">{f.title}</Text>
                            <Stack gap="sm">{f.points.map(p => <Inline key={p} align="flex-start" gap="sm"><Icon name="check" size={16} color="accent" /><Text variant="small" color="textMuted" style={{ flex: 1 }}>{p}</Text></Inline>)}</Stack>
                        </Card>
                    ))}
                </Grid>
            </Band>

            <Band>
                <Text variant="h1" align="center" accessibilityRole="header">Built for real people with real financial questions</Text>
                <Grid min={260}>
                    {AUDIENCE.map(a => (
                        <Card key={a}><Inline align="flex-start" gap="md"><Icon name="check" size={20} color="accent" /><Text style={{ flex: 1 }}>{a}</Text></Inline></Card>
                    ))}
                </Grid>
            </Band>

            <Band alt narrow>
                <Text variant="h1" align="center" accessibilityRole="header">Why Modulos is different</Text>
                <Card padded={false}>
                    <Inline style={{ padding: space.lg }} gap="lg"><Text variant="captionStrong" color="textMuted" style={{ flex: 1 }}>OTHER APPS</Text><Text variant="captionStrong" color="accent" style={{ flex: 1 }}>MODULOS</Text></Inline>
                    {COMPARE.map(([other, ours]) => (
                        <Inline key={other} gap="lg" align="flex-start" style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
                            <Inline gap="sm" align="flex-start" style={{ flex: 1 }}><Icon name="cross" size={16} color="risk" /><Text variant="small" color="textMuted" style={{ flex: 1 }}>{other}</Text></Inline>
                            <Inline gap="sm" align="flex-start" style={{ flex: 1 }}><Icon name="check" size={16} color="accent" /><Text variant="small" style={{ flex: 1 }}>{ours}</Text></Inline>
                        </Inline>
                    ))}
                </Card>
            </Band>

            <Band narrow>
                <Stack gap="xl" align="center">
                    <Text variant="display" align="center">Know before you borrow. Pay off faster. <Text variant="display" color="accent">Sleep better.</Text></Text>
                    <Button size="lg" onPress={onSignUp}>Try Modulos now — free</Button>
                    <Text variant="small" color="textMuted" align="center">No credit card required. Bank connection optional. Just clarity.</Text>
                </Stack>
            </Band>

            <Band alt gap="lg">
                <Text variant="caption" color="textMuted" align="center">Legal disclaimer: this app provides general educational guidance only and does not replace financial advice.</Text>
                <Inline justify="center" gap="xl">
                    <TextButton color="textMuted" onPress={() => router.push('/privacy')}>Privacy policy</TextButton>
                    <TextButton color="textMuted" onPress={() => openUrl('mailto:sri.meduri@berkeley.edu')}>Contact</TextButton>
                </Inline>
            </Band>
        </ScrollView>
    );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <Card pad="compact" gap="xs" style={{ flex: 1 }}>
        <Text variant="caption" color="textMuted">{label}</Text>
        <Text variant="smallStrong" numberOfLines={2}>{value}</Text>
    </Card>
);

export default LandingScreen;
