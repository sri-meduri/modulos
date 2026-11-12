import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../contexts/FinanceContext';
import { LOAN_PRESETS } from '../constants';
import { Loan, LoanType } from '../types';
import { calculateMinimumPayment } from '../services/loanCalculator';
import { Badge, Button, Card, Chip, Field, Icon, ICONS, money } from '../components/ui';
import PlaidLinkButton from '../components/PlaidLinkButton';

type Step = 'choose' | 'manual' | 'review';

const STEP_NO: Record<Step, number> = { choose: 1, manual: 2, review: 2 };
const TYPE_CHIPS: { type: LoanType; label: string }[] = [
    { type: LoanType.CreditCard, label: 'Credit card' },
    { type: LoanType.Auto, label: 'Auto loan' },
    { type: LoanType.Student, label: 'Student loan' },
    { type: LoanType.Other, label: 'Other' },
];

const Progress: React.FC<{ step: Step }> = ({ step }) => (
    <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2].map(n => <div key={n} className={`flex-1 h-1 rounded ${n <= STEP_NO[step] ? 'bg-accent' : 'bg-surface-2'}`} />)}
    </div>
);

/** First-run: connect a bank (recommended) or enter income + a first debt. */
const OnboardingPage: React.FC = () => {
    const navigate = useNavigate();
    const { finances, setFinances, setSettings } = useFinance();
    const [step, setStep] = useState<Step>('choose');

    // manual
    const [income, setIncome] = useState('');
    const [type, setType] = useState<LoanType>(LoanType.Auto);
    const [balance, setBalance] = useState('');
    const [apr, setApr] = useState(String(LOAN_PRESETS['Auto'].apr));
    const [minPay, setMinPay] = useState('');

    const finish = () => {
        setSettings(p => ({ ...p, onboardingDone: true }));
        navigate('/overview', { replace: true });
    };

    const pickType = (t: LoanType) => { setType(t); setApr(String(LOAN_PRESETS[t].apr)); };
    const estMin = calculateMinimumPayment(parseFloat(balance) || 0, parseFloat(apr) || 0, LOAN_PRESETS[type].termYears);

    const saveManual = () => {
        const bal = parseFloat(balance) || 0;
        const loan: Loan | null = bal > 0 ? {
            id: `debt-${Date.now()}`, name: LOAN_PRESETS[type].name, type, balance: bal, originalAmount: bal,
            apr: parseFloat(apr) || 0, term: LOAN_PRESETS[type].termYears,
            ...(minPay !== '' ? { minPaymentOverride: parseFloat(minPay) || 0 } : {}), status: 'active',
        } : null;
        setFinances(prev => ({
            ...prev,
            incomeType: 'net',
            monthlyNetIncome: parseFloat(income) || prev.monthlyNetIncome,
            loans: loan ? [...prev.loans, loan] : prev.loans,
        }));
        finish();
    };

    // review (bank path): income suggestion from bank history, debts + bills from the import
    const suggestedIncome = (() => {
        const months = (finances.incomeExpenseHistory ?? []).filter(m => m.income > 0).slice(-3);
        return months.length ? Math.round(months.reduce((a, m) => a + m.income, 0) / months.length) : 0;
    })();
    const bankLoans = finances.loans.filter(l => l.plaidItemId);
    const bankBills = finances.expenses.filter(e => e.plaidItemId && e.amount > 0);
    const [reviewIncome, setReviewIncome] = useState<string | null>(null);
    const incomeValue = reviewIncome ?? String(finances.monthlyNetIncome || suggestedIncome || '');

    const confirmReview = () => {
        const inc = parseFloat(incomeValue) || 0;
        setFinances(prev => ({ ...prev, incomeType: 'net', monthlyNetIncome: inc }));
        finish();
    };

    return (
        <div className="min-h-screen bg-dark-bg text-dark-text px-6 pt-14 pb-8 flex flex-col gap-[18px] max-w-md mx-auto">
            <Progress step={step} />

            {step === 'choose' && (
                <>
                    <div className="flex flex-col gap-2">
                        <span className="text-[13px] text-dark-text-secondary">Step 1 of 2</span>
                        <h1 className="text-[28px] leading-[34px] font-bold">Add your finances the fast way</h1>
                        <p className="text-[15px] leading-[22px] text-dark-text-secondary">Link your bank and we fill in income, bills and debts for you. Or enter it yourself.</p>
                    </div>
                    <Card className="flex flex-col gap-3.5 p-5 border-[1.5px] border-accent">
                        <div className="flex items-center justify-between"><span className="text-[17px] font-semibold">Connect your bank</span><span className="text-xs font-semibold bg-accent text-dark-bg rounded-full px-2.5 py-1">Recommended</span></div>
                        <ul className="flex flex-col gap-2.5 text-sm text-[#D5DAE3]">
                            {['Income and monthly bills detected automatically', 'Loans and cards imported with balances and rates', 'Debt payments marked as paid when they happen'].map(t => (
                                <li key={t} className="flex gap-2.5 items-start"><Icon d={ICONS.check} className="w-[18px] h-[18px] text-accent shrink-0 mt-0.5" /><span>{t}</span></li>
                            ))}
                        </ul>
                        <PlaidLinkButton onImported={() => setStep('review')} />
                        <div className="flex gap-2 items-center text-xs text-dark-text-secondary"><Icon d={ICONS.lock} className="w-4 h-4 shrink-0" /><span>Read-only. We can never move money or see your login.</span></div>
                    </Card>
                    <button onClick={() => setStep('manual')} className="text-left">
                        <Card className="flex flex-col gap-1.5 p-5 hover:border-line">
                            <span className="text-[17px] font-semibold">Enter it myself</span>
                            <span className="text-sm text-dark-text-secondary">Add income and your first debt by hand. Takes about 2 minutes.</span>
                        </Card>
                    </button>
                    <div className="flex-1" />
                    <Button variant="ghost" onClick={finish}>Skip for now</Button>
                </>
            )}

            {step === 'manual' && (
                <>
                    <div className="flex flex-col gap-2">
                        <span className="text-[13px] text-dark-text-secondary">Step 2 of 2 · Manual</span>
                        <h1 className="text-[28px] leading-[34px] font-bold">Income and your first debt</h1>
                    </div>
                    <Field label="Monthly take-home pay" prefix="$" value={income} onChange={setIncome} placeholder="0" />
                    <div className="flex flex-col gap-2.5">
                        <span className="text-[13px] text-dark-text-secondary">Type of debt</span>
                        <div className="flex flex-wrap gap-2">{TYPE_CHIPS.map(t => <Chip key={t.type} active={type === t.type} onClick={() => pickType(t.type)}>{t.label}</Chip>)}</div>
                    </div>
                    <Field label="Balance" prefix="$" value={balance} onChange={setBalance} placeholder="0" />
                    <div className="flex gap-3">
                        <Field className="flex-1" label="APR" suffix="%" value={apr} onChange={setApr} hint={LOAN_PRESETS[type].hint} />
                        <Field className="flex-1" label="Minimum payment" prefix="$" value={minPay} onChange={setMinPay} placeholder={estMin > 0 ? String(Math.round(estMin)) : '0'} />
                    </div>
                    <div className="flex-1" />
                    <p className="text-[13px] text-dark-text-secondary text-center">Expenses can wait. Add them later in Budget.</p>
                    <Button size="lg" disabled={!(parseFloat(balance) > 0) && !(parseFloat(income) > 0)} onClick={saveManual}>See my plan</Button>
                    <Button variant="ghost" onClick={() => setStep('choose')}>Back</Button>
                </>
            )}

            {step === 'review' && (
                <>
                    <div className="flex flex-col gap-2">
                        <span className="text-[13px] text-dark-text-secondary">Step 2 of 2 · From your bank</span>
                        <h1 className="text-[28px] leading-[34px] font-bold">Here’s what we found</h1>
                        <p className="text-[15px] leading-[22px] text-dark-text-secondary">Check it over. Change anything that looks off.</p>
                    </div>
                    <Card className="flex flex-col gap-3">
                        <div className="flex justify-between text-[13px] text-dark-text-secondary"><span>Income</span><Badge>From bank</Badge></div>
                        <Field label="Monthly take-home" prefix="$" value={incomeValue} onChange={setReviewIncome} hint={suggestedIncome ? `About ${money(suggestedIncome)} a month in deposits over the last few months.` : 'No deposits found yet. Enter your take-home pay.'} />
                    </Card>
                    <Card className="flex flex-col gap-3">
                        <div className="flex justify-between text-[13px] text-dark-text-secondary"><span>Debts</span><span>{bankLoans.length} account{bankLoans.length === 1 ? '' : 's'}</span></div>
                        {bankLoans.length === 0 && <p className="text-sm text-dark-text-secondary">No loan or card accounts found. You can add debts by hand later.</p>}
                        {bankLoans.map(l => (
                            <div key={l.id} className="flex flex-col gap-2 border-t border-dark-border pt-3 first:border-0 first:pt-0">
                                <span className="text-[15px] font-medium">{l.name}</span>
                                <div className="flex gap-2.5">
                                    <Field className="flex-1" label="Balance" prefix="$" value={l.balance} onChange={v => setFinances(p => ({ ...p, loans: p.loans.map(x => x.id === l.id ? { ...x, balance: parseFloat(v) || 0 } : x) }))} />
                                    <Field className="flex-1" label="APR" suffix="%" value={l.apr || ''} placeholder="needed" onChange={v => setFinances(p => ({ ...p, loans: p.loans.map(x => x.id === l.id ? { ...x, apr: parseFloat(v) || 0 } : x) }))} />
                                </div>
                                {!l.apr && <span className="text-xs text-amber">Your bank didn’t share the APR. Enter it for accurate results.</span>}
                            </div>
                        ))}
                    </Card>
                    <Card className="flex flex-col gap-3">
                        <div className="flex justify-between text-[13px] text-dark-text-secondary"><span>Fixed bills</span><span>recurring charges</span></div>
                        {bankBills.length === 0 && <p className="text-sm text-dark-text-secondary">No recurring bills found yet. Add them later in Budget.</p>}
                        {bankBills.map(e => (
                            <div key={e.id} className="flex items-center gap-3 text-[15px]">
                                <span className="flex-1 min-w-0 truncate">{e.name}</span>
                                <div className="flex items-center h-10 bg-dark-bg border border-line rounded-lg px-2.5 w-28 focus-within:border-accent">
                                    <span className="text-dark-text-secondary mr-1">$</span>
                                    <input aria-label={`${e.name} amount`} type="number" inputMode="decimal" value={e.amount} onChange={ev => setFinances(p => ({ ...p, expenses: p.expenses.map(x => x.id === e.id ? { ...x, amount: parseFloat(ev.target.value) || 0 } : x) }))} className="w-full bg-transparent outline-none tnum" />
                                </div>
                            </div>
                        ))}
                    </Card>
                    <div className="flex-1" />
                    <Button size="lg" onClick={confirmReview}>Looks right, continue</Button>
                </>
            )}
        </div>
    );
};

export default OnboardingPage;
