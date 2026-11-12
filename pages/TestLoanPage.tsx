import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFinance } from '../contexts/FinanceContext';
import { Loan, LoanType, RiskProfile } from '../types';
import { evaluateNewLoan, RISK_LABELS, Verdict } from '../services/loanTest';
import { formatMonthYear, addMonths } from '../services/payoff';
import { Badge, Button, Card, Field, Gauge, Icon, ICONS, PageTitle, SegTabs, money, pct } from '../components/ui';

const VERDICT_STYLE: Record<Verdict, { tone: 'mint' | 'amber' | 'red'; chip: string }> = {
    'Safe': { tone: 'mint', chip: 'bg-accent text-dark-bg' },
    'Borderline': { tone: 'amber', chip: 'bg-amber text-dark-bg' },
    'Not Recommended': { tone: 'red', chip: 'bg-risk text-dark-bg' },
};

const TestLoanPage: React.FC = () => {
    const navigate = useNavigate();
    const { finances, setFinances, settings, setSettings, activeLoans, monthlyExpensesTotal } = useFinance();
    const [amount, setAmount] = useState('18000');
    const [apr, setApr] = useState('6.9');
    const [months, setMonths] = useState('60');

    const result = useMemo(() => evaluateNewLoan(
        { amount: parseFloat(amount) || 0, apr: parseFloat(apr) || 0, termMonths: Math.max(1, parseInt(months, 10) || 0) },
        {
            loans: activeLoans, netIncome: finances.monthlyNetIncome, grossIncome: finances.monthlyGrossIncome,
            expensesTotal: monthlyExpensesTotal, riskProfile: settings.riskProfile, strategy: settings.strategy ?? 'avalanche',
            customOrder: settings.customOrder, extra: settings.extraPayment ?? 0,
        }
    ), [amount, apr, months, activeLoans, finances.monthlyNetIncome, finances.monthlyGrossIncome, monthlyExpensesTotal, settings]);

    const style = VERDICT_STYLE[result.verdict];
    const valid = (parseFloat(amount) || 0) > 0;
    const dateOf = (m: number) => (m === 0 ? 'Debt-free' : formatMonthYear(addMonths(m)));
    const noIncome = finances.monthlyNetIncome <= 0 && finances.monthlyGrossIncome <= 0;

    const addLoan = (status: 'considering' | 'active') => {
        const amt = parseFloat(amount) || 0;
        const loan: Loan = {
            id: `debt-${Date.now()}`, name: status === 'considering' ? 'New loan (what-if)' : 'New loan', type: LoanType.Other,
            balance: amt, originalAmount: amt, apr: parseFloat(apr) || 0, term: Math.max(1, parseInt(months, 10) || 12) / 12,
            status,
        };
        setFinances(prev => ({ ...prev, loans: [...prev.loans, loan] }));
        navigate(status === 'considering' ? '/plan' : '/debts');
    };

    return (
        <div className="flex flex-col gap-4 pb-20">
            <Link to="/debts" className="flex items-center gap-1 text-sm text-dark-text-secondary w-fit"><Icon d={ICONS.back} className="w-4 h-4" />Debts</Link>
            <PageTitle>Test a new loan</PageTitle>

            <div className="flex gap-2.5">
                <Field className="flex-[1.2]" label="Amount" prefix="$" value={amount} onChange={setAmount} />
                <Field className="flex-1" label="APR" suffix="%" value={apr} onChange={setApr} />
                <Field className="flex-1" label="Months" value={months} onChange={setMonths} inputMode="numeric" />
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-dark-text-secondary">Risk profile</span>
                <SegTabs label="Risk profile" value={settings.riskProfile}
                    options={[RiskProfile.Low, RiskProfile.Average, RiskProfile.High].map(v => ({ value: v, label: RISK_LABELS[v].label }))}
                    onChange={v => setSettings(p => ({ ...p, riskProfile: v }))} />
                <span className="text-xs text-dark-text-secondary">{RISK_LABELS[settings.riskProfile].blurb}</span>
            </div>

            {noIncome && (
                <Card tone="amber" className="text-sm">Add your take-home pay in <Link to="/budget" className="underline text-amber">Budget</Link> for an accurate verdict.</Card>
            )}

            <Card className="flex flex-col gap-3" aria-live="polite">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] text-dark-text-secondary">Verdict</span>
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${style.chip}`}>{result.verdict}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>DTI today → with loan</span>
                    <span className="font-bold tnum">{pct(result.dtiBefore)} → {pct(result.dtiAfter)}</span>
                </div>
                <Gauge value={result.dtiAfter} before={result.dtiBefore} limit={result.threshold}
                    tone={style.tone} label="Debt-to-income with the new loan against your limit" />
                <ul className="flex flex-col gap-1 text-sm text-[#D5DAE3]">
                    {result.reasons.map(r => <li key={r}>{r}</li>)}
                </ul>
                {result.incomeApproximated && !noIncome && (
                    <p className="text-xs text-dark-text-secondary">DTI uses take-home pay because gross income isn’t set, so it reads a little high.</p>
                )}
            </Card>

            <Card className="flex flex-col gap-2.5">
                <Row2 label="New payment" value={money(result.payment)} />
                <Row2 label="Left over each month" value={`${money(result.leftoverBefore)} → ${money(result.leftoverAfter)}`} bad={result.leftoverAfter < 0} />
                <Row2 label="Debt-free date" value={result.neverPaysOffAfter ? 'Not within 50 years' : `${dateOf(result.debtFreeMonthsBefore)} → ${dateOf(result.debtFreeMonthsAfter)}`} />
                <Row2 label="If pay dropped 10%" value={`${money(result.stressLeftover)} left`} bad={result.stressLeftover < 0} />
            </Card>

            {result.suggestions.length > 0 && (
                <Card tone="mint" className="flex flex-col gap-2">
                    <span className="font-semibold">What would make this safer?</span>
                    <ul className="list-disc pl-5 text-sm text-[#D5DAE3] flex flex-col gap-1">
                        {result.suggestions.map(s => <li key={s}>{s}</li>)}
                    </ul>
                </Card>
            )}
            <p className="text-xs text-dark-text-secondary">General educational guidance, not financial advice.</p>

            <div className="fixed left-0 right-0 bottom-[84px] z-40 px-4 pb-3 pt-2 bg-gradient-to-t from-dark-bg via-dark-bg/95 to-transparent">
                <div className="max-w-xl mx-auto flex gap-2.5">
                    <Button size="lg" className="flex-1" disabled={!valid} onClick={() => addLoan('considering')}>Add as a what-if</Button>
                    <Button size="lg" variant="secondary" disabled={!valid} onClick={() => addLoan('active')}>I took it</Button>
                </div>
            </div>
        </div>
    );
};

const Row2: React.FC<{ label: string; value: string; bad?: boolean }> = ({ label, value, bad }) => (
    <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <span>{label}</span>
        <span className={`tnum font-semibold ${bad ? 'text-risk' : ''}`}>{value}</span>
    </div>
);

export default TestLoanPage;
