import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { PayoffStrategy } from '../types';
import { usePlan } from '../hooks/usePlan';
import { addMonths, extraForTarget, formatDuration, formatMonthYear, monthsBetweenNow, payoffLabel, simulatePayoff } from '../services/payoff';
import { Button, Card, Chip, Field, PageTitle, Section, SegTabs, money } from '../components/ui';

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
const LOAN_COLORS = ['#34D399', '#F5C26B', '#60A5FA', '#C084FC', '#F472B6', '#94A3B8'];
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

const PlanPage: React.FC = () => {
    const { isGuest, isSample, openAuth } = useAuth();
    const { finances, settings, setSettings, activeLoans, consideringLoans, monthlyLeftoverMoney } = useFinance();
    const plan = usePlan();
    const [target, setTarget] = useState(settings.targetDate ?? '');
    const [includeIds, setIncludeIds] = useState<string[]>([]);
    const [refiId, setRefiId] = useState('');
    const [refiApr, setRefiApr] = useState('');

    // Realistic slider range: leftover cash, but never fiddly-huge or tiny.
    const cap = Math.max(100, Math.min(1000, roundTo(Math.max(0, monthlyLeftoverMoney), 50)));
    const extra = plan.extra;
    const setExtra = (v: number) => setSettings(p => ({ ...p, extraPayment: Math.max(0, Math.round(v)) }));
    const names = useMemo(() => new Map(finances.loans.map(l => [l.id, l.name])), [finances.loans]);

    const series = useMemo(() => {
        const n = Math.max(plan.baseline.months, plan.plan.months);
        const stride = Math.max(1, Math.ceil(n / 30));
        const rows: { label: string; min: number; plan: number }[] = [];
        for (let i = 0; i <= n; i += stride) {
            rows.push({
                label: formatMonthYear(addMonths(i)),
                min: Math.round(plan.baseline.balanceSeries[Math.min(i, plan.baseline.months)] ?? 0),
                plan: Math.round(plan.plan.balanceSeries[Math.min(i, plan.plan.months)] ?? 0),
            });
        }
        return rows;
    }, [plan]);

    const stacked = useMemo(() => {
        const n = plan.plan.months;
        const stride = Math.max(1, Math.ceil(n / 24));
        const rows: Record<string, number | string>[] = [];
        for (let i = 0; i <= n; i += stride) {
            const row: Record<string, number | string> = { label: formatMonthYear(addMonths(i)) };
            plan.plan.order.forEach(id => (row[id] = Math.round(plan.plan.loanSeries[id]?.[i] ?? 0)));
            rows.push(row);
        }
        return rows;
    }, [plan]);

    const targetMonths = target ? monthsBetweenNow(target) : 0;
    const needed = useMemo(
        () => (target && targetMonths > 0 ? extraForTarget(activeLoans, targetMonths, plan.strategy, plan.customOrder) : undefined),
        [target, targetMonths, activeLoans, plan.strategy, plan.customOrder]
    );

    const milestones = useMemo(() => {
        const s = plan.plan.balanceSeries;
        if (s.length < 2 || plan.plan.neverPaysOff) return [];
        const start = s[0];
        const out: { label: string; at: number }[] = [];
        const half = s.findIndex(b => b <= start / 2);
        const firstOff = Math.min(...Object.values(plan.plan.payoffMonth));
        if (Number.isFinite(firstOff) && plan.plan.order.length > 1) out.push({ label: 'First debt paid off', at: firstOff });
        if (half > 0) out.push({ label: 'Halfway there', at: half });
        out.push({ label: 'Debt-free', at: plan.plan.months });
        return out;
    }, [plan]);

    // What-ifs: considering loans + a refinance, compared with the current plan.
    const whatIf = useMemo(() => {
        const withLoans = [...activeLoans, ...consideringLoans.filter(l => includeIds.includes(l.id)).map(l => ({ ...l, status: 'active' as const }))];
        const refiApr_ = parseFloat(refiApr);
        const adjusted = refiId && refiApr_ >= 0 && refiApr !== ''
            ? withLoans.map(l => (l.id === refiId ? { ...l, apr: refiApr_ } : l))
            : withLoans;
        if (adjusted === activeLoans || (includeIds.length === 0 && !(refiId && refiApr !== ''))) return null;
        return simulatePayoff(adjusted, plan.extra, plan.strategy, plan.customOrder);
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
            <div className="flex flex-col gap-4">
                <PageTitle>Plan</PageTitle>
                <Card className="flex flex-col gap-3">
                    <p className="text-[15px] text-dark-text-secondary">Add a debt to see how an extra payment changes your payoff date.</p>
                    <Link to="/debts?add=1"><Button size="lg" className="w-full">+ Add a debt</Button></Link>
                </Card>
            </div>
        );
    }

    const interestDelta = plan.interestSaved;
    const multi = activeLoans.length > 1;

    return (
        <div className="flex flex-col gap-4">
            <PageTitle>Plan</PageTitle>

            <div>
                <SegTabs label="Payoff method" value={plan.strategy} options={STRATEGIES} onChange={v => setSettings(p => ({ ...p, strategy: v }))} />
                <p className="text-xs text-dark-text-secondary mt-1.5">{BLURB[plan.strategy]}</p>
            </div>

            <Card className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                    <label htmlFor="extra" className="text-[13px] text-dark-text-secondary">Extra each month</label>
                    <span className="text-[32px] font-bold tnum">{money(extra)}</span>
                </div>
                <input id="extra" type="range" min={0} max={cap} step={25} value={Math.min(extra, cap)} onChange={e => setExtra(+e.target.value)}
                    className="w-full accent-[#34D399] h-6" aria-valuetext={`${money(extra)} extra per month`} />
                <div className="flex gap-2 flex-wrap items-center">
                    {[50, 100, 250, 500].filter(v => v <= Math.max(cap, 100)).map(v => <Chip key={v} active={extra === v} onClick={() => setExtra(v)}>{money(v)}</Chip>)}
                    <Chip active={extra === 0} onClick={() => setExtra(0)}>None</Chip>
                </div>
                {monthlyLeftoverMoney > 0 && extra > monthlyLeftoverMoney && (
                    <p className="text-xs text-amber">That’s more than the {money(monthlyLeftoverMoney)} you have left over each month.</p>
                )}
            </Card>

            <Card className="flex flex-col gap-3">
                <div className="flex gap-4 text-xs text-dark-text-secondary">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#6B7385]" />Minimums only</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent" />With {money(extra)} extra</span>
                </div>
                <div style={{ height: 160 }} role="img" aria-label="Balance with and without the extra payment">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                            <CartesianGrid stroke="#262A33" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                            <YAxis hide />
                            <Tooltip contentStyle={{ background: '#181B22', border: '1px solid #3A4050', borderRadius: 12 }} formatter={(v: number) => money(v)} />
                            <Line type="monotone" dataKey="min" name="Minimums only" stroke="#6B7385" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="plan" name="With extra" stroke="#34D399" strokeWidth={3} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-sm"><span>Debt-free</span>
                    <span className="tnum font-semibold">{extra > 0 && plan.monthsSaved > 0 ? `${payoffLabel(plan.baseline)} → ` : ''}{payoffLabel(plan.plan)}</span></div>
                <div className="flex justify-between text-sm"><span>Total interest</span>
                    <span className="tnum font-semibold">{extra > 0 && interestDelta >= 1 ? `${money(plan.baseline.totalInterest)} → ` : ''}{money(plan.plan.totalInterest)}</span></div>
                {extra > 0 && (plan.monthsSaved > 0 || interestDelta >= 1) && (
                    <p className="text-sm font-semibold text-accent">
                        {[plan.monthsSaved > 0 ? `${formatDuration(plan.monthsSaved)} sooner` : null, interestDelta >= 1 ? `about ${money(roundTo(interestDelta, 10))} less interest` : null].filter(Boolean).join(' and ')}.
                    </p>
                )}
                {plan.plan.neverPaysOff && <p className="text-sm text-risk">At these payments the balance never reaches zero. Raise the extra or check your APRs.</p>}
                {milestones.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {milestones.map(m => (
                            <span key={m.label} className="text-xs rounded-full bg-[#12302A] text-accent px-2.5 py-1 font-semibold">★ {m.label} · {formatMonthYear(addMonths(m.at))}</span>
                        ))}
                    </div>
                )}
            </Card>

            {(isGuest && !isSample) && extra > 0 && (
                <Card tone="mint" className="flex items-center justify-between gap-3 text-sm">
                    <span>Sign in to save this plan and sync it across devices.</span>
                    <Button size="md" onClick={() => openAuth('signup')}>Sign in</Button>
                </Card>
            )}

            <Section title={`Payoff order · ${plan.strategy === 'avalanche' ? 'highest APR first' : plan.strategy === 'snowball' ? 'smallest balance first' : 'your order'}`}>
                <Card className="flex flex-col gap-2.5">
                    {plan.plan.order.map((id, i) => {
                        const l = activeLoans.find(x => x.id === id)!;
                        return (
                            <div key={id} className="flex items-center gap-3 text-[15px]">
                                <span className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                                <span className="flex-1 min-w-0 truncate">{names.get(id)}</span>
                                <span className="text-[13px] text-amber">{l.apr.toFixed(1)}%</span>
                                <span className="w-16 text-right tnum">{money(l.balance)}</span>
                                {plan.strategy === 'custom' && multi && (
                                    <span className="flex">
                                        <button aria-label={`Move ${l.name} up`} disabled={i === 0} onClick={() => moveCustom(id, -1)} className="h-8 w-8 text-dark-text-secondary disabled:opacity-30">↑</button>
                                        <button aria-label={`Move ${l.name} down`} disabled={i === plan.plan.order.length - 1} onClick={() => moveCustom(id, 1)} className="h-8 w-8 text-dark-text-secondary disabled:opacity-30">↓</button>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {multi && <p className="text-xs text-dark-text-secondary">Paid off: {plan.plan.order.map(id => `${names.get(id)} ${plan.plan.payoffMonth[id] ? formatMonthYear(addMonths(plan.plan.payoffMonth[id])) : '—'}`).join(' · ')}</p>}
                </Card>
            </Section>

            {multi && !plan.plan.neverPaysOff && (
                <Section title="Balance by debt">
                    <Card>
                        <div style={{ height: 170 }} role="img" aria-label="Stacked balance by debt over time">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stacked} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                                    <CartesianGrid stroke="#262A33" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ background: '#181B22', border: '1px solid #3A4050', borderRadius: 12 }} formatter={(v: number, n: string) => [money(v), names.get(n) ?? n]} />
                                    {plan.plan.order.map((id, i) => <Area key={id} type="monotone" dataKey={id} stackId="1" stroke={LOAN_COLORS[i % LOAN_COLORS.length]} fill={LOAN_COLORS[i % LOAN_COLORS.length]} fillOpacity={0.35} />)}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-dark-text-secondary">
                            {plan.plan.order.map((id, i) => <span key={id} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: LOAN_COLORS[i % LOAN_COLORS.length] }} />{names.get(id)}</span>)}
                        </div>
                    </Card>
                </Section>
            )}

            <Section title="Aim for a date">
                <Card className="flex flex-col gap-3">
                    <Field label="Debt-free by" type="text" inputMode="text" value={target}
                        onChange={v => { setTarget(v); setSettings(p => ({ ...p, targetDate: v || undefined })); }} placeholder="YYYY-MM, e.g. 2028-06" />
                    {target && targetMonths <= 0 && <p className="text-sm text-amber">Pick a future month (YYYY-MM).</p>}
                    {target && targetMonths > 0 && needed === null && <p className="text-sm text-risk">That date isn’t reachable with these debts.</p>}
                    {target && targetMonths > 0 && typeof needed === 'number' && (
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm">{needed === 0 ? 'You’re already on track for that date.' : <>You’d need <strong>{money(needed)}</strong> extra each month.</>}</span>
                            {needed > 0 && <Button size="md" variant="secondary" onClick={() => setExtra(needed)}>Use this</Button>}
                        </div>
                    )}
                </Card>
            </Section>

            <Section title="What if…">
                <Card className="flex flex-col gap-3">
                    {consideringLoans.length === 0 && <p className="text-sm text-dark-text-secondary">Add a loan you’re considering with <Link to="/debts/test" className="text-accent underline">Test a new loan</Link> to compare it here.</p>}
                    {consideringLoans.map(l => (
                        <label key={l.id} className="flex items-center gap-3 text-[15px] min-h-11">
                            <input type="checkbox" className="w-5 h-5 accent-[#34D399]" checked={includeIds.includes(l.id)}
                                onChange={e => setIncludeIds(ids => (e.target.checked ? [...ids, l.id] : ids.filter(x => x !== l.id)))} />
                            <span className="flex-1">{l.name} · {money(l.balance)} at {l.apr}%</span>
                        </label>
                    ))}
                    <div className="flex gap-2.5 items-end">
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label htmlFor="refi" className="text-[13px] text-dark-text-secondary">Refinance a debt</label>
                            <select id="refi" value={refiId} onChange={e => setRefiId(e.target.value)} className="h-12 bg-dark-card border border-line rounded-xl px-3 text-base">
                                <option value="">Choose…</option>
                                {activeLoans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <Field className="w-28" label="New APR" suffix="%" value={refiApr} onChange={setRefiApr} />
                    </div>
                    {whatIf && (
                        <div className="rounded-xl bg-surface-2 p-3 text-sm flex flex-col gap-1.5">
                            <div className="flex justify-between"><span>Debt-free</span><span className="tnum font-semibold">{payoffLabel(plan.plan)} → {payoffLabel(whatIf)}</span></div>
                            <div className="flex justify-between"><span>Total interest</span><span className="tnum font-semibold">{money(plan.plan.totalInterest)} → {money(whatIf.totalInterest)}</span></div>
                        </div>
                    )}
                </Card>
            </Section>
        </div>
    );
};

export default PlanPage;
