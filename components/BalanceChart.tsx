import React, { useMemo } from 'react';
import { colors } from '../theme';
import { addMonths, formatMonthYear } from '../services/payoff';
import { Chart, checkpoints } from './ui';

/**
 * Past month-end balances (solid) joined to the projected payoff path (dashed), with a
 * rounded balance axis and a few month checkpoints. One x axis: [past..., now, projected...].
 */
const BalanceChart: React.FC<{ history?: { month: string; balance: number }[]; projection: number[]; currentBalance: number; height?: number }> = ({ history, projection, currentBalance, height = 180 }) => {
    const model = useMemo(() => {
        const nowKey = new Date().toISOString().slice(0, 7);
        const past = (history ?? []).filter(h => h.month < nowKey).slice(-12);
        const stride = Math.max(1, Math.ceil(projection.length / 24));
        const idx = projection.map((_, i) => i).filter(i => i % stride === 0 || i === projection.length - 1);
        const actual: (number | null)[] = [...past.map(h => h.balance), currentBalance, ...idx.slice(1).map(() => null)];
        const future: (number | null)[] = [...past.map(() => null), ...idx.map(i => projection[i])];
        const labels = [
            ...past.map(h => { const [y, m] = h.month.split('-').map(Number); return formatMonthYear(new Date(y, m - 1, 1)); }),
            ...idx.map(i => formatMonthYear(addMonths(i))),
        ];
        return { actual, future, labels };
    }, [history, projection, currentBalance]);

    if (model.future.length < 2) return null;
    return (
        <Chart height={height} label="Debt balance over time, falling toward zero" xTicks={checkpoints(model.labels, 4)}
            series={[{ data: model.future, color: colors.accent, dashed: true }, { data: model.actual, color: colors.accent, fill: true }]} />
    );
};

export default BalanceChart;
