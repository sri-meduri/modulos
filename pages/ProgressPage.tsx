import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinance } from '../contexts/FinanceContext';
import { Payment } from '../types';
import { confirmPayment, logManualPayment, milestonesFor, removePayment, summarizeProgress } from '../services/payments';
import { getEffectiveMinPayment } from '../services/loanCalculator';
import { Badge, Button, Card, Chip, Field, PageTitle, ProgressBar, Section, Sheet, money } from '../components/ui';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const ProgressPage: React.FC = () => {
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

    const history = useMemo(() => (finances.balanceHistory ?? []).map(h => ({ label: h.month, balance: Math.round(h.balance) })), [finances.balanceHistory]);

    const openLog = () => {
        const first = activeLoans[0];
        setLoanId(first?.id ?? '');
        setAmount(first ? String(Math.round(getEffectiveMinPayment(first))) : '');
        setLogOpen(true);
    };

    const submit = () => {
        const amt = parseFloat(amount) || 0;
        if (!loanId || amt <= 0) return;
        const out = logManualPayment(finances, { loanId, amount: amt });
        setFinances(out.finances);
        setLogOpen(false);
        setToast(out.paidOff ? `${loanName(loanId)} is paid off. 🎉` : `Logged ${money(amt)}. ${money(amt - out.interestPortion)} went to principal, ${money(out.interestPortion)} to interest.`);
    };

    return (
        <div className="flex flex-col gap-4">
            <PageTitle right={activeLoans.length > 0 ? <Button size="md" onClick={openLog}>Log a payment</Button> : undefined}>Progress</PageTitle>

            {toast && <Card tone="mint" role="status" className="text-sm flex justify-between gap-3"><span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast(null)}>✕</button></Card>}

            {unconfirmed.slice(0, 2).map(p => (
                <Card key={p.id} tone="mint" className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-base font-semibold">Payment detected</span>
                        <span className="text-sm text-[#B8C2CF]">{money(p.amount)} to {loanName(p.loanId, p)} cleared on {fmtDate(p.date)}. Is that right?</span>
                    </div>
                    <div className="flex gap-2.5">
                        <Button size="md" className="flex-1" onClick={() => setFinances(prev => confirmPayment(prev, p.id))}>Yes, that’s right</Button>
                        <Button size="md" variant="secondary" onClick={() => setFinances(prev => removePayment(prev, p.id))}>Not a debt payment</Button>
                    </div>
                </Card>
            ))}

            {paymentCandidates.slice(0, 2).map(c => (
                <Card key={c.id} tone="amber" className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-base font-semibold">Is this a debt payment?</span>
                        <span className="text-sm text-[#D5DAE3]">{money(c.amount)} to {c.payee} on {fmtDate(c.date)}. Tell us once and we’ll remember it.</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {activeLoans.map(l => <Chip key={l.id} onClick={() => resolveCandidate(c.id, l.id)}>{l.name}</Chip>)}
                        <Chip onClick={() => resolveCandidate(c.id, null)}>Not a debt</Chip>
                    </div>
                </Card>
            ))}

            <Card className="flex flex-col gap-3 p-5">
                <div className="flex items-baseline justify-between">
                    <span className="text-[13px] text-dark-text-secondary">Total paid off</span>
                    <span className="text-[13px] text-dark-text-secondary">of {money(progress.startingTotal)}</span>
                </div>
                <div className="text-[32px] font-bold tnum">{money(progress.paidOff)}</div>
                <ProgressBar value={progress.percent} label="Total paid off" />
                {progress.extraPaidTotal > 0 && <span className="text-sm text-accent font-semibold">{money(progress.extraPaidTotal)} paid above minimums so far.</span>}
            </Card>

            {history.length >= 2 && (
                <Card className="flex flex-col gap-2">
                    <span className="text-[13px] text-dark-text-secondary">Balance history</span>
                    <div style={{ height: 130 }} role="img" aria-label="Total debt balance by month">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                                <CartesianGrid stroke="#262A33" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis hide domain={[0, 'dataMax']} />
                                <Tooltip contentStyle={{ background: '#181B22', border: '1px solid #3A4050', borderRadius: 12 }} formatter={(v: number) => money(v)} />
                                <Area type="monotone" dataKey="balance" stroke="#34D399" strokeWidth={3} fill="#34D399" fillOpacity={0.12} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}

            <Section title="Milestones">
                <div className="flex flex-wrap gap-2">
                    {milestones.map(m => (
                        <span key={m.id} className={`text-xs font-semibold rounded-full px-3 py-1.5 ${m.done ? 'bg-[#12302A] text-accent' : 'bg-dark-card border border-dark-border text-dark-text-secondary'}`}>
                            {m.done ? '★' : '○'} {m.label}
                        </span>
                    ))}
                </div>
            </Section>

            <Section title="Recent payments">
                {payments.length === 0 && (
                    <Card className="text-sm text-dark-text-secondary">No payments yet. Log one when you pay, or <Link to="/profile/accounts" className="text-accent underline">connect a bank</Link> and we’ll catch them automatically.</Card>
                )}
                {payments.slice(0, 12).map(p => (
                    <Card key={p.id} className="p-3.5 flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[15px] truncate">{loanName(p.loanId, p)}</span>
                            <span className="text-[13px] text-dark-text-secondary">{fmtDate(p.date)} · {p.source === 'detected' ? (p.confirmed ? 'auto-detected' : 'detected, unconfirmed') : 'marked by you'}{(p.extra ?? 0) > 0 ? ` · ${money(p.extra!)} extra` : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {p.source === 'detected' && <Badge tone="mint">Detected</Badge>}
                            <span className="text-[15px] font-semibold tnum">{money(p.amount)}</span>
                        </div>
                    </Card>
                ))}
            </Section>

            <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Log a payment">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Debt">
                    {activeLoans.map(l => <Chip key={l.id} active={loanId === l.id} onClick={() => { setLoanId(l.id); setAmount(String(Math.round(getEffectiveMinPayment(l)))); }}>{l.name}</Chip>)}
                </div>
                <Field label="Amount paid" prefix="$" value={amount} onChange={setAmount} />
                <p className="text-xs text-dark-text-secondary">Part of each payment covers that month’s interest; the rest lowers your balance.</p>
                <Button size="lg" disabled={!loanId || !(parseFloat(amount) > 0)} onClick={submit}>Log payment</Button>
            </Sheet>
        </div>
    );
};

export default ProgressPage;
