import React, { useMemo, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useBanks } from '../hooks/useBanks';
import { useAuth } from '../contexts/AuthContext';
import { EXPENSE_CATEGORIES } from '../constants';
import { computeMonthlyTakeHome, zipToState } from '../services/taxCalculator';
import { Asset, AssetType, Expense } from '../types';
import { Badge, Button, Card, Field, Icon, ICONS, PageTitle, Row, Section, money } from '../components/ui';
import PlaidLinkButton from '../components/PlaidLinkButton';

const FIXED_ID = 'fixed-total';
const CATEGORY_NAMES = new Set(EXPENSE_CATEGORIES.flatMap(c => c.subcategories.map(s => s.name)));
const num = (v: string) => Math.max(0, parseFloat(v) || 0);

const BudgetPage: React.FC = () => {
    const { isSample } = useAuth();
    const { finances, setFinances, monthlyExpensesTotal, monthlyDebtPayments, monthlyLeftoverMoney } = useFinance();
    const { banks, loaded } = useBanks();
    const [openCat, setOpenCat] = useState<string | null>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showGross, setShowGross] = useState(false);

    const expenses = finances.expenses;
    const amountOf = (id: string) => expenses.find(e => e.id === id)?.amount ?? 0;
    const setExpense = (id: string, name: string, amount: number) =>
        setFinances(prev => ({
            ...prev,
            expenses: prev.expenses.some(e => e.id === id)
                ? prev.expenses.map(e => (e.id === id ? { ...e, amount } : e))
                : [...prev.expenses, { id, name, amount }],
        }));
    const removeExpense = (id: string) => setFinances(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));

    const otherBills: Expense[] = expenses.filter(e => e.id !== FIXED_ID && !(CATEGORY_NAMES.has(e.id) && !e.plaidItemId) && e.amount !== 0);
    const breakdownTotal = expenses.filter(e => CATEGORY_NAMES.has(e.id) && !e.plaidItemId).reduce((a, e) => a + e.amount, 0);

    // Suggestion from the bank's recent income history.
    const suggestedIncome = useMemo(() => {
        const months = (finances.incomeExpenseHistory ?? []).filter(m => m.income > 0).slice(-3);
        return months.length ? Math.round(months.reduce((a, m) => a + m.income, 0) / months.length) : 0;
    }, [finances.incomeExpenseHistory]);

    // Gross → take-home estimate (existing tax model).
    const estimate = useMemo(() => {
        if (finances.monthlyGrossIncome <= 0 || finances.zip.length !== 5 || !zipToState(finances.zip)) return null;
        return Math.round(Math.max(0, computeMonthlyTakeHome(finances.monthlyGrossIncome, finances.filingStatus, finances.monthly401kContribution, finances.annualIraContribution, finances.annualItemizedDeductions, finances.zip).takeHome));
    }, [finances]);

    const assets = finances.assets ?? [];
    const setAsset = (id: string, patch: Partial<Asset>) => setFinances(prev => ({ ...prev, assets: (prev.assets ?? []).map(a => (a.id === id ? { ...a, ...patch } : a)) }));

    return (
        <div className="flex flex-col gap-4">
            <PageTitle>Budget</PageTitle>

            <Card className="flex flex-col gap-1.5 p-5">
                <span className="text-[13px] text-dark-text-secondary">Left over each month after bills and minimums</span>
                <span className={`text-4xl font-bold tnum ${monthlyLeftoverMoney < 0 ? 'text-risk' : 'text-accent'}`}>{money(monthlyLeftoverMoney)}</span>
                <span className="text-[13px] text-dark-text-secondary">{money(finances.monthlyNetIncome)} income − {money(monthlyExpensesTotal)} bills − {money(monthlyDebtPayments)} minimums</span>
            </Card>

            {loaded && !isSample && banks.length === 0 && (
                <Card tone="mint" className="flex flex-col gap-3">
                    <div className="flex gap-3 items-start">
                        <Icon d={ICONS.bank} className="w-6 h-6 text-accent shrink-0" />
                        <div className="flex flex-col gap-1">
                            <span className="text-base font-semibold">Connect a bank</span>
                            <span className="text-sm text-[#B8C2CF]">Skip the typing. We’ll fill in income and bills and keep them current.</span>
                        </div>
                    </div>
                    <PlaidLinkButton size="md" />
                </Card>
            )}

            <Section title="Income" right={<span className="text-sm text-dark-text-secondary">{banks.length ? 'Bank + manual' : 'Manual'}</span>}>
                <Card className="flex flex-col gap-3">
                    <Field label="Monthly take-home pay" prefix="$" value={finances.monthlyNetIncome || ''} placeholder="0"
                        onChange={v => setFinances(p => ({ ...p, incomeType: 'net', monthlyNetIncome: num(v) }))} />
                    {suggestedIncome > 0 && suggestedIncome !== finances.monthlyNetIncome && (
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-dark-text-secondary">Your bank shows about <strong className="text-dark-text">{money(suggestedIncome)}</strong> a month coming in.</span>
                            <Button size="md" variant="secondary" onClick={() => setFinances(p => ({ ...p, monthlyNetIncome: suggestedIncome }))}>Use</Button>
                        </div>
                    )}
                    <button type="button" className="text-sm text-accent font-semibold text-left" aria-expanded={showGross} onClick={() => setShowGross(s => !s)}>
                        {showGross ? 'Hide' : 'Estimate from gross salary (optional)'}
                    </button>
                    {showGross && (
                        <div className="flex flex-col gap-3">
                            <Field label="Gross monthly income" prefix="$" value={finances.monthlyGrossIncome || ''} onChange={v => setFinances(p => ({ ...p, incomeType: 'gross', monthlyGrossIncome: num(v) }))}
                                hint="Also makes your debt-to-income ratio more accurate." />
                            <div className="flex gap-3">
                                <Field className="flex-1" label="ZIP code" type="text" inputMode="numeric" value={finances.zip} onChange={v => setFinances(p => ({ ...p, zip: v.replace(/\D/g, '').slice(0, 5) }))} />
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <label htmlFor="filing" className="text-[13px] text-dark-text-secondary">Filing status</label>
                                    <select id="filing" value={finances.filingStatus} onChange={e => setFinances(p => ({ ...p, filingStatus: e.target.value as 'single' | 'married' }))} className="h-12 bg-dark-card border border-line rounded-xl px-3 text-base">
                                        <option value="single">Single</option><option value="married">Married</option>
                                    </select>
                                </div>
                            </div>
                            {estimate !== null
                                ? <div className="flex items-center justify-between gap-3 text-sm"><span>Estimated take-home <strong>{money(estimate)}</strong>/mo after taxes</span><Button size="md" variant="secondary" onClick={() => setFinances(p => ({ ...p, monthlyNetIncome: estimate }))}>Use</Button></div>
                                : <p className="text-xs text-dark-text-secondary">Enter gross income and a valid ZIP to estimate.</p>}
                        </div>
                    )}
                </Card>
            </Section>

            <Section title="Fixed expenses" right={<span className="text-sm text-dark-text-secondary">{money(monthlyExpensesTotal)}/mo</span>}>
                <Card className="flex flex-col gap-3">
                    <Field label="Monthly bills (rent, utilities, insurance…)" prefix="$" value={amountOf(FIXED_ID) || ''} placeholder="0"
                        hint="One number is enough. Anything in the breakdown below is added on top."
                        onChange={v => setExpense(FIXED_ID, 'Monthly bills', num(v))} />
                </Card>

                {otherBills.map(e => (
                    <Card key={e.id} className="p-3.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <span className="text-[15px] truncate">{e.name}</span>
                            {e.plaidItemId && <span><Badge>From bank</Badge></span>}
                        </div>
                        <div className="flex items-center h-10 bg-dark-bg border border-line rounded-lg px-2.5 w-28 focus-within:border-accent">
                            <span className="text-dark-text-secondary mr-1">$</span>
                            <input aria-label={`${e.name} amount`} type="number" inputMode="decimal" value={e.amount} onChange={ev => setExpense(e.id, e.name, num(ev.target.value))} className="w-full bg-transparent outline-none tnum" />
                        </div>
                        {!e.id.startsWith('property-tax-') && <button aria-label={`Remove ${e.name}`} onClick={() => removeExpense(e.id)} className="h-9 w-9 text-dark-text-secondary hover:text-risk">✕</button>}
                    </Card>
                ))}

                <button type="button" className="text-sm text-accent font-semibold text-left" aria-expanded={showBreakdown} onClick={() => setShowBreakdown(s => !s)}>
                    {showBreakdown ? 'Hide detailed breakdown' : `Detailed breakdown (optional)${breakdownTotal > 0 ? ` · ${money(breakdownTotal)}` : ''}`}
                </button>
                {showBreakdown && (
                    <div className="flex flex-col gap-2">
                        {EXPENSE_CATEGORIES.map(cat => {
                            const total = cat.subcategories.reduce((a, s) => a + amountOf(s.name), 0);
                            const open = openCat === cat.id;
                            return (
                                <Card key={cat.id} className="p-0 overflow-hidden">
                                    <button className="w-full flex items-center justify-between px-4 h-12 text-left" aria-expanded={open} onClick={() => setOpenCat(open ? null : cat.id)}>
                                        <span className="text-[15px] font-medium">{cat.label}</span>
                                        <span className="tnum text-sm text-dark-text-secondary">{money(total)} {open ? '▴' : '▾'}</span>
                                    </button>
                                    {open && (
                                        <div className="px-4 pb-4 grid grid-cols-1 gap-3">
                                            {cat.subcategories.map(s => (
                                                <Field key={s.name} label={s.name} prefix="$" value={amountOf(s.name) || ''} placeholder="0" hint={s.placeholder}
                                                    onChange={v => setExpense(s.name, s.name, num(v))} />
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
                <AddBill onAdd={(name, amount) => setExpense(`custom-${Date.now()}`, name, amount)} />
            </Section>

            <Section title="Assets" right={<span className="text-sm text-dark-text-secondary">{money(assets.reduce((a, x) => a + x.value, 0))}</span>}>
                {assets.map(a => (
                    <Card key={a.id} className="p-3.5 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                            <input aria-label="Asset name" value={a.name} onChange={e => setAsset(a.id, { name: e.target.value })} className="flex-1 min-w-0 bg-transparent text-[15px] font-medium outline-none" />
                            {a.plaidItemId && <Badge>From bank</Badge>}
                            <button aria-label={`Remove ${a.name}`} onClick={() => setFinances(p => ({ ...p, assets: (p.assets ?? []).filter(x => x.id !== a.id) }))} className="h-9 w-9 text-dark-text-secondary hover:text-risk">✕</button>
                        </div>
                        <div className="flex gap-2.5">
                            <select aria-label="Asset type" value={a.type} onChange={e => setAsset(a.id, { type: e.target.value as AssetType })} className="flex-1 h-10 bg-dark-bg border border-line rounded-lg px-2 text-sm">
                                {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <div className="flex items-center h-10 bg-dark-bg border border-line rounded-lg px-2.5 w-32 focus-within:border-accent">
                                <span className="text-dark-text-secondary mr-1">$</span>
                                <input aria-label={`${a.name} value`} type="number" inputMode="decimal" value={a.value} onChange={e => setAsset(a.id, { value: num(e.target.value) })} className="w-full bg-transparent outline-none tnum" />
                            </div>
                        </div>
                    </Card>
                ))}
                <Button variant="secondary" onClick={() => setFinances(p => ({ ...p, assets: [...(p.assets ?? []), { id: `asset-${Date.now()}`, name: 'New asset', type: AssetType.Cash, value: 0 }] }))}>+ Add an asset</Button>
            </Section>
        </div>
    );
};

const AddBill: React.FC<{ onAdd: (name: string, amount: number) => void }> = ({ onAdd }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>+ Add another bill</Button>;
    return (
        <Card className="flex flex-col gap-3">
            <Field label="Name" type="text" inputMode="text" value={name} onChange={setName} placeholder="e.g. Gym" />
            <Field label="Monthly amount" prefix="$" value={amount} onChange={setAmount} />
            <div className="flex gap-2.5">
                <Button className="flex-1" disabled={!name.trim() || !(parseFloat(amount) > 0)} onClick={() => { onAdd(name.trim(), parseFloat(amount)); setOpen(false); setName(''); setAmount(''); }}>Add</Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
        </Card>
    );
};

export default BudgetPage;
