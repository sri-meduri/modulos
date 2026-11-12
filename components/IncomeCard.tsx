import React, { useMemo } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { computeMonthlyTakeHome, getLocalInfo, getStateName, getStateStdDed, zipToState } from '../services/taxCalculator';
import { Finances } from '../types';
import { money, toNumber } from '../lib/format';
import { Card, Chip, Field, Inline, SegTabs, Stack, Text } from './ui';

const LIMIT_401K_ANNUAL = 23_500;
const LIMIT_IRA_ANNUAL = 7_000;
const dollars = (n: number, digits = 0) => `$${n.toLocaleString('en-US', { maximumFractionDigits: digits })}`;

interface Note { bad: boolean; text: string }

/**
 * Income entry: type take-home pay directly (Net), or enter gross pay and let the
 * tax calculator (2026 federal + state + FICA + local, 401(k), IRA, itemized
 * deductions) work out take-home pay. In Gross mode take-home is recalculated
 * whenever an input changes and used as net income.
 */
const IncomeCard: React.FC = () => {
    const { finances, setFinances } = useFinance();
    const mode = finances.incomeType;

    // Any change to a tax input recalculates take-home pay (once the ZIP is recognized).
    const update = (patch: Partial<Finances>) => setFinances(prev => {
        const next = { ...prev, ...patch };
        if (next.incomeType === 'gross') {
            const { takeHome, stateCode } = computeMonthlyTakeHome(next.monthlyGrossIncome, next.filingStatus ?? 'single', next.monthly401kContribution ?? 0, next.annualIraContribution ?? 0, next.annualItemizedDeductions ?? 0, next.zip ?? '');
            if (stateCode) next.monthlyNetIncome = Math.max(0, takeHome);
        }
        return next;
    });

    const zip = finances.zip ?? '';
    const filing = finances.filingStatus ?? 'single';
    const k401 = finances.monthly401kContribution ?? 0;
    const ira = finances.annualIraContribution ?? 0;
    const itemized = finances.annualItemizedDeductions ?? 0;

    const grossAnnual = (finances.monthlyGrossIncome ?? 0) * 12;
    const k401Annual = k401 * 12;
    const k401MonthlyMax = Math.min(LIMIT_401K_ANNUAL, grossAnnual) / 12;
    const iraLimit = Math.min(LIMIT_IRA_ANNUAL, Math.max(0, grossAnnual - k401Annual));

    const stateCode = zip.length === 5 ? zipToState(zip) : null;
    const local = zip.length >= 3 ? getLocalInfo(zip) : undefined;
    const zipStatus = zip.length < 5 ? 'idle' : stateCode ? 'valid' : 'invalid';
    const stateStd = stateCode ? getStateStdDed(stateCode, filing) : null;
    const takeHome = useMemo(
        () => (stateCode ? Math.max(0, computeMonthlyTakeHome(finances.monthlyGrossIncome, filing, k401, ira, itemized, zip).takeHome) : null),
        [stateCode, finances.monthlyGrossIncome, filing, k401, ira, itemized, zip]
    );

    // Suggestion from the bank's recent deposits.
    const suggested = useMemo(() => {
        const months = (finances.incomeExpenseHistory ?? []).filter(m => m.income > 0).slice(-3);
        return months.length ? Math.round(months.reduce((a, m) => a + m.income, 0) / months.length) : 0;
    }, [finances.incomeExpenseHistory]);

    let k401Note: Note | null = null;
    if (k401Annual > grossAnnual) k401Note = { bad: true, text: `Cannot exceed gross income. Capped at ${dollars(k401MonthlyMax, 2)}/mo.` };
    else if (k401Annual > LIMIT_401K_ANNUAL) k401Note = { bad: true, text: `Exceeds IRS limit of ${dollars(LIMIT_401K_ANNUAL)}/yr. Capped at ${dollars(LIMIT_401K_ANNUAL / 12, 2)}/mo.` };
    else if (k401Annual > 0) k401Note = { bad: false, text: `${dollars(k401Annual)}/yr of ${dollars(LIMIT_401K_ANNUAL)} limit used` };

    let iraNote: Note | null = null;
    if (ira > Math.max(0, grossAnnual - k401Annual)) iraNote = { bad: true, text: `Cannot exceed remaining gross income after 401(k). Capped at ${dollars(iraLimit)}/yr.` };
    else if (ira > LIMIT_IRA_ANNUAL) iraNote = { bad: true, text: `Exceeds IRS limit of ${dollars(LIMIT_IRA_ANNUAL)}/yr. Capped at ${dollars(LIMIT_IRA_ANNUAL)}.` };
    else if (ira > iraLimit) iraNote = { bad: true, text: `Capped at ${dollars(iraLimit)} — remaining gross after 401(k).` };
    else if (ira > 0) iraNote = { bad: false, text: `${dollars(ira)}/yr of ${dollars(LIMIT_IRA_ANNUAL)} limit used` };

    return (
        <Card gap="lg">
            <Stack gap="sm">
                <Text variant="label" color="textMuted">How do you want to enter your income?</Text>
                <SegTabs label="Income entry method" value={mode} options={[{ value: 'net', label: 'Take-home (net)' }, { value: 'gross', label: 'Gross + taxes' }]} onChange={v => update({ incomeType: v })} />
            </Stack>

            {mode === 'net' ? (
                <>
                    <Inline><Field label="Monthly take-home pay" prefix="$" numeric value={finances.monthlyNetIncome || ''} placeholder="0" onChange={v => update({ monthlyNetIncome: toNumber(v) })}
                        hint="Enter what lands in your account each month, or switch to Gross + taxes to calculate it." /></Inline>
                    {suggested > 0 && suggested !== finances.monthlyNetIncome ? (
                        <Inline justify="space-between" gap="md">
                            <Text variant="small" color="textMuted" style={{ flex: 1 }}>Your bank shows about <Text variant="smallStrong">{money(suggested)}</Text> a month coming in.</Text>
                            <Chip onPress={() => update({ monthlyNetIncome: suggested })}>Use</Chip>
                        </Inline>
                    ) : null}
                </>
            ) : (
                <Stack gap="lg">
                    <Inline><Field label="Monthly gross income" prefix="$" numeric value={finances.monthlyGrossIncome || ''} placeholder="0" onChange={v => update({ monthlyGrossIncome: toNumber(v) })} hint="Also makes your debt-to-income ratio more accurate." /></Inline>
                    <Text variant="caption" color="textMuted">Tax calculator — 2026 · federal · state · FICA · local. State personal exemptions are applied automatically (1 single, 2 married).</Text>
                    <Stack gap="sm">
                        <Text variant="label" color="textMuted">Filing status</Text>
                        <SegTabs label="Filing status" value={filing} options={[{ value: 'single', label: 'Single' }, { value: 'married', label: 'Married' }]} onChange={v => update({ filingStatus: v })} />
                    </Stack>
                    <Stack gap="xs">
                        <Inline><Field label="ZIP code" keyboardType="number-pad" maxLength={5} value={zip} placeholder="e.g. 10001" onChange={v => update({ zip: v.replace(/\D/g, '').slice(0, 5) })} /></Inline>
                        {zipStatus === 'valid' ? <Text variant="caption" color="accent">{getStateName(stateCode!)}{local ? ` · ${local.city} (+${(local.rate * 100).toFixed(2)}% local)` : ''}</Text> : null}
                        {zipStatus === 'invalid' ? <Text variant="caption" color="risk">ZIP not recognized</Text> : null}
                    </Stack>
                    <Inline align="flex-start">
                        <Field label="Monthly 401(k)" prefix="$" numeric value={k401 || ''} placeholder="0" onChange={v => update({ monthly401kContribution: Math.min(toNumber(v), k401MonthlyMax) })} hint={`2026 limit: ${dollars(LIMIT_401K_ANNUAL)}/yr`} />
                        <Field label="Annual IRA" prefix="$" numeric value={ira || ''} placeholder="0" onChange={v => update({ annualIraContribution: Math.min(toNumber(v), iraLimit) })} hint={`2026 limit: ${dollars(LIMIT_IRA_ANNUAL)}`} />
                    </Inline>
                    {k401Note ? <Text variant="caption" color={k401Note.bad ? 'risk' : 'textMuted'}>401(k): {k401Note.text}</Text> : null}
                    {iraNote ? <Text variant="caption" color={iraNote.bad ? 'risk' : 'textMuted'}>IRA: {iraNote.text}</Text> : null}
                    <Inline><Field label="Annual itemized deductions" prefix="$" numeric value={itemized || ''} placeholder="0" onChange={v => update({ annualItemizedDeductions: toNumber(v) })}
                        hint={stateStd != null ? `State standard deduction ${dollars(stateStd)}; whichever is higher is used.` : 'Whichever is higher than the standard deduction is used.'} /></Inline>
                    <Card tone="mint" gap="xs">
                        <Inline justify="space-between"><Text variant="label" color="textMuted">Monthly take-home pay</Text><Text variant="stat" color="accent">{takeHome != null ? money(takeHome, { cents: true }) : '—'}</Text></Inline>
                        <Text variant="caption" color="textMuted">{takeHome != null ? 'Used as your net income.' : 'Enter your ZIP code to include state and local taxes in the estimate.'}</Text>
                    </Card>
                </Stack>
            )}
        </Card>
    );
};

export default IncomeCard;
