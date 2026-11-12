import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { DTI_THRESHOLDS } from '../constants';
import { usePlan } from '../hooks/usePlan';
import { useBanks } from '../hooks/useBanks';
import { simulatePayoff, payoffLabel, formatDuration } from '../services/payoff';
import { missedPayments, summarizeProgress } from '../services/payments';
import { Badge, Button, Card, Gauge, PageTitle, Ring, Row, money, pct, useCountUp, Icon, ICONS } from '../components/ui';
import BalanceChart, { buildBalancePoints } from '../components/BalanceChart';
import PlaidLinkButton from '../components/PlaidLinkButton';

const OverviewPage: React.FC = () => {
    const navigate = useNavigate();
    const { isSample } = useAuth();
    const { finances, settings, setSettings, activeLoans, totalDebt, monthlyDebtPayments, monthlyLeftoverMoney, debtToIncomeRatio, totalAssets, netWorth, paymentCandidates } = useFinance();
    const { banks, loaded } = useBanks();
    const plan = usePlan();

    const progress = useMemo(() => summarizeProgress(finances), [finances]);
    const missed = useMemo(() => missedPayments(finances), [finances]);
    const threshold = DTI_THRESHOLDS[settings.riskProfile];
    const dtiTone = debtToIncomeRatio > threshold ? 'red' : debtToIncomeRatio > threshold * 0.85 ? 'amber' : 'mint';

    // Insight: what an extra $100/mo would do on top of the current plan.
    const insight = useMemo(() => {
        if (activeLoans.length === 0) return null;
        const bumped = simulatePayoff(activeLoans, plan.extra + 100, plan.strategy, plan.customOrder);
        const months = plan.plan.months - bumped.months;
        const interest = plan.plan.totalInterest - bumped.totalInterest;
        if (plan.plan.neverPaysOff || months < 1 || interest < 1) return null;
        return `An extra $100 a month gets you debt-free about ${formatDuration(months)} sooner and saves roughly ${money(interest)} in interest.`;
    }, [activeLoans, plan]);

    const points = useMemo(
        () => buildBalancePoints(finances.balanceHistory, plan.plan.balanceSeries, totalDebt),
        [finances.balanceHistory, plan.plan.balanceSeries, totalDebt]
    );

    const animatedDebt = useCountUp(totalDebt);
    const hasDebt = activeLoans.length > 0;
    const showNudge = loaded && !isSample && banks.length === 0 && !settings.bankNudgeDismissed;

    if (!hasDebt) {
        return (
            <div className="flex flex-col gap-4">
                <PageTitle>Overview</PageTitle>
                <Card className="flex flex-col gap-3">
                    <h2 className="text-xl font-semibold">Add your first debt</h2>
                    <p className="text-dark-text-secondary text-[15px]">Your debt-free date, progress and plan appear here as soon as there is a debt to track.</p>
                    <Button size="lg" onClick={() => navigate('/debts?add=1')}>+ Add a debt</Button>
                    <PlaidLinkButton variant="secondary" onImported={() => navigate('/overview')}>Import from bank</PlaidLinkButton>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <PageTitle>Overview</PageTitle>

            {missed.length > 0 && (
                <Card tone="amber" role="status" className="text-[15px]">
                    <strong className="text-amber">Heads up · </strong>
                    No payment seen yet this month for {missed.map(l => l.name).join(', ')}. Due date has passed. <Link to="/progress" className="underline text-amber">Log it</Link> if you already paid.
                </Card>
            )}
            {paymentCandidates.length > 0 && (
                <Card tone="amber" className="text-[15px]">
                    <strong className="text-amber">Is this a debt payment? · </strong>
                    {paymentCandidates.length} bank transaction{paymentCandidates.length === 1 ? '' : 's'} could be. <Link to="/progress" className="underline text-amber">Review</Link>
                </Card>
            )}

            <Card className="flex flex-col gap-3.5 p-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] text-dark-text-secondary">Debt-free date</span>
                        <span className="text-4xl leading-10 font-bold tnum">{payoffLabel(plan.plan)}</span>
                        <span className="text-sm font-semibold text-accent">
                            {plan.extra > 0 ? `On track · ${money(plan.extra)} extra a month` : 'Minimums only · set an extra in Plan'}
                        </span>
                    </div>
                    <Ring value={progress.percent} label={`${Math.round(progress.percent * 100)} percent paid off`} />
                </div>
                <Row label={<span className="text-dark-text-secondary text-sm">Total debt</span>} value={<span className="font-semibold">{money(animatedDebt)}</span>} />
            </Card>

            <div className="grid grid-cols-3 gap-2.5">
                <Card className="p-3 flex flex-col gap-1">
                    <span className="text-xs text-dark-text-secondary">Min. payments</span>
                    <span className="text-lg font-bold tnum">{money(monthlyDebtPayments)}</span>
                </Card>
                <Card className="p-3 flex flex-col gap-1">
                    <span className="text-xs text-dark-text-secondary">DTI</span>
                    <span className={`text-lg font-bold tnum ${dtiTone === 'red' ? 'text-risk' : dtiTone === 'amber' ? 'text-amber' : ''}`}>{pct(debtToIncomeRatio)}</span>
                </Card>
                <Card className="p-3 flex flex-col gap-1">
                    <span className="text-xs text-dark-text-secondary">Left over</span>
                    <span className={`text-lg font-bold tnum ${monthlyLeftoverMoney < 0 ? 'text-risk' : ''}`}>{money(monthlyLeftoverMoney)}</span>
                </Card>
            </div>
            <Card className="py-3">
                <Gauge value={debtToIncomeRatio} limit={threshold} tone={dtiTone} label="Debt-to-income ratio against your limit" />
            </Card>

            <Card className="flex flex-col gap-2">
                <div className="flex justify-between text-[13px] text-dark-text-secondary">
                    <span>Debt balance</span>
                    <span>Now → {payoffLabel(plan.plan)}</span>
                </div>
                <BalanceChart points={points} />
            </Card>

            {insight && (
                <Card tone="amber" className="text-sm leading-5 text-[#D5DAE3]">
                    <span className="text-amber font-semibold">Insight · </span>{insight}
                </Card>
            )}

            {(totalAssets > 0 || (finances.assets ?? []).length > 0) && (
                <Card className="flex flex-col gap-2">
                    <Row label="Assets" value={money(totalAssets)} />
                    <Row label="Net worth" value={<span className={`font-semibold ${netWorth < 0 ? 'text-risk' : 'text-accent'}`}>{money(netWorth)}</span>} />
                </Card>
            )}

            {showNudge && (
                <Card tone="mint" className="flex flex-col gap-3">
                    <div className="flex gap-3 items-start">
                        <Icon d={ICONS.bank} className="w-6 h-6 text-accent shrink-0" />
                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-base font-semibold">Skip the typing</span>
                            <span className="text-sm text-[#B8C2CF]">Connect a bank and we fill in income, bills and debts, then log payments when they happen.</span>
                        </div>
                        <button aria-label="Dismiss" className="text-dark-text-secondary h-8 w-8" onClick={() => setSettings(p => ({ ...p, bankNudgeDismissed: true }))}>✕</button>
                    </div>
                    <PlaidLinkButton size="md" />
                </Card>
            )}
        </div>
    );
};

export default OverviewPage;
