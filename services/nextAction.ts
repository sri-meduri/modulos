import { Finances, Loan, Settings } from '../types';
import { DTI_THRESHOLDS } from '../constants';
import { getEffectiveMinPayment } from './loanCalculator';
import { orderLoans } from './payoff';
import { missedPayments } from './payments';
import { money } from '../lib/format';

export interface NextAction {
    id: string;
    title: string;
    detail: string;
    cta: string;
    /** Navigate to a screen, or apply an extra payment of `applyExtra` dollars. */
    route?: string;
    applyExtra?: number;
    tone: 'accent' | 'amber' | 'risk';
}

export interface ActionInput {
    finances: Finances;
    settings: Settings;
    activeLoans: Loan[];
    /** Monthly leftover after bills and minimums. */
    leftover: number;
    dti: number;
    unconfirmedPayments: number;
    paymentCandidates: number;
    hasBank: boolean;
    now?: Date;
}

/**
 * The single most useful thing to do next, in priority order: fix problems first
 * (no income, overspending, missed payment, risky DTI), then pending questions,
 * then the best way to speed up payoff.
 */
export const nextBestAction = (i: ActionInput): NextAction => {
    const { finances, settings, activeLoans } = i;
    const extra = settings.extraPayment ?? 0;
    const focus = orderLoans(activeLoans, settings.strategy ?? 'avalanche', settings.customOrder)[0];

    if (finances.monthlyNetIncome <= 0) {
        return { id: 'income', tone: 'amber', title: 'Add your take-home pay', detail: 'Your leftover money, DTI and plan all depend on it.', cta: 'Add income', route: '/budget' };
    }
    if (i.leftover < 0) {
        return { id: 'overspent', tone: 'risk', title: `Bills and minimums exceed income by ${money(-i.leftover)}`, detail: 'Review your fixed expenses, or check that every entry is monthly.', cta: 'Review budget', route: '/budget' };
    }
    const missed = missedPayments(finances, i.now);
    if (missed.length > 0) {
        return { id: 'missed', tone: 'amber', title: `Pay ${missed[0].name}`, detail: `Its due date has passed and no payment is logged this month. Minimum ${money(getEffectiveMinPayment(missed[0]))}.`, cta: 'Log a payment', route: '/progress' };
    }
    if (i.unconfirmedPayments > 0 || i.paymentCandidates > 0) {
        return { id: 'review', tone: 'accent', title: 'Confirm what your bank found', detail: 'A couple of payments need a quick yes or no so your progress stays accurate.', cta: 'Review', route: '/progress' };
    }
    if (i.dti > DTI_THRESHOLDS[settings.riskProfile]) {
        return { id: 'dti', tone: 'risk', title: 'Your debt-to-income is above your limit', detail: 'Avoid new borrowing and put extra money toward your focus debt until it comes down.', cta: 'See your plan', route: '/plan' };
    }
    if (focus && extra <= 0 && i.leftover > 0) {
        const suggest = Math.max(25, Math.min(Math.floor(i.leftover / 25) * 25, Math.round(i.leftover * 0.5 / 25) * 25 || 25));
        return { id: 'extra', tone: 'accent', title: `Put ${money(suggest)} a month toward ${focus.name}`, detail: `It's your focus debt (${focus.apr.toFixed(1)}% APR). You have ${money(i.leftover)} available each month.`, cta: `Apply ${money(suggest)} extra`, applyExtra: suggest };
    }
    if (!i.hasBank && !settings.bankNudgeDismissed && finances.loans.some(l => !l.plaidItemId)) {
        return { id: 'bank', tone: 'accent', title: 'Let your bank do the typing', detail: 'Connect a bank to keep balances and payments up to date automatically.', cta: 'Connect a bank', route: '/profile/accounts' };
    }
    if (focus) {
        return { id: 'ontrack', tone: 'accent', title: `You're on track: send ${money(getEffectiveMinPayment(focus) + extra)} to ${focus.name}`, detail: 'That is your focus debt this month. Log it in Progress when it clears.', cta: 'Log a payment', route: '/progress' };
    }
    return { id: 'adddebt', tone: 'accent', title: 'Add a debt to build your plan', detail: 'Your debt-free date appears as soon as there is a debt to track.', cta: 'Add a debt', route: '/debts?add=1' };
};
