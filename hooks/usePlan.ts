import { useMemo } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { PayoffStrategy } from '../types';
import { simulatePayoff, PayoffResult } from '../services/payoff';

export interface PlanState {
    strategy: PayoffStrategy;
    extra: number;
    customOrder: string[];
    /** Minimum payments only. */
    baseline: PayoffResult;
    /** Chosen strategy plus extra. */
    plan: PayoffResult;
    monthsSaved: number;
    interestSaved: number;
}

/** The user's saved plan, simulated against their active debts. */
export const usePlan = (overrides?: { strategy?: PayoffStrategy; extra?: number }): PlanState => {
    const { activeLoans, settings } = useFinance();
    const strategy = overrides?.strategy ?? settings.strategy ?? 'avalanche';
    const extra = overrides?.extra ?? settings.extraPayment ?? 0;
    const customOrder = settings.customOrder ?? [];
    return useMemo(() => {
        const baseline = simulatePayoff(activeLoans, 0, strategy, customOrder);
        const plan = simulatePayoff(activeLoans, extra, strategy, customOrder);
        return {
            strategy, extra, customOrder, baseline, plan,
            monthsSaved: Math.max(0, baseline.months - plan.months),
            interestSaved: Math.max(0, baseline.totalInterest - plan.totalInterest),
        };
    }, [activeLoans, strategy, extra, customOrder.join('|')]);
};
