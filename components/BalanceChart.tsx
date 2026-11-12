import React, { useMemo } from 'react';
import { colors } from '../theme';
import { addMonths, formatMonthYear } from '../services/payoff';
import { Chart } from './ui';

/**
 * Past month-end balances (solid) joined to the projected payoff path (dashed).
 * One x axis: [past months..., now, projected months...].
 */
const BalanceChart: React.FC<{ history?: { month: string; balance: number }[]; projection: number[]; currentBalance: number; height?: number }> = ({ history, projection, currentBalance, height = 160 }) => {
    const model = useMemo(() => {
        const nowKey = new Date().toISOString().slice(0, 7);
        const past = (history ?? []).filter(h => h.month < nowKey).slice(-12);
        const stride = Math.max(1, Math.ceil(projection.length / 24));
        const projected = projection.filter((_, i) => i % stride === 0 || i === projection.length - 1);
        const actual: (number | null)[] = [...past.map(h => h.balance), currentBalance, ...projected.slice(1).map(() => null)];
        const future: (number | null)[] = [...past.map(() => null), ...projected];
        const [fy, fm] = (past[0]?.month ?? nowKey).split('-').map(Number);
        return {
            actual, future,
            start: formatMonthYear(new Date(fy, fm - 1, 1)),
            end: formatMonthYear(addMonths(projection.length - 1)),
        };
    }, [history, projection, currentBalance]);

    if (model.future.length < 2) return null;
    return (
        <Chart height={height} label="Debt balance over time, falling toward zero" xLabels={[model.start, model.end]}
            series={[{ data: model.future, color: colors.accent, dashed: true }, { data: model.actual, color: colors.accent, fill: true }]} />
    );
};

export default BalanceChart;
