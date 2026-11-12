import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addMonths } from '../services/payoff';
import { money } from './ui';

export interface BalancePoint { label: string; actual?: number; projected?: number }

const fmtMonth = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

/** Past balances (solid) joined to the projected payoff path (dashed). */
export const buildBalancePoints = (
    history: { month: string; balance: number }[] | undefined,
    projection: number[],
    currentBalance: number
): BalancePoint[] => {
    const now = new Date();
    const nowKey = now.toISOString().slice(0, 7);
    const past = (history ?? []).filter(h => h.month < nowKey).slice(-12);
    const points: BalancePoint[] = past.map(h => {
        const [y, m] = h.month.split('-').map(Number);
        return { label: fmtMonth(new Date(y, m - 1, 1)), actual: h.balance };
    });
    // Sample the projection so long payoffs stay readable.
    const stride = Math.max(1, Math.ceil(projection.length / 24));
    projection.forEach((bal, i) => {
        if (i % stride !== 0 && i !== projection.length - 1) return;
        points.push({
            label: fmtMonth(addMonths(i)),
            ...(i === 0 ? { actual: currentBalance } : {}),
            projected: bal,
        });
    });
    return points;
};

const BalanceChart: React.FC<{ points: BalancePoint[]; height?: number }> = ({ points, height = 150 }) => {
    const nowLabel = useMemo(() => fmtMonth(addMonths(0)), []);
    if (points.length < 2) return null;
    return (
        <div style={{ height }} role="img" aria-label="Debt balance over time, falling toward zero">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="#262A33" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis hide domain={[0, 'dataMax']} />
                    <Tooltip contentStyle={{ background: '#181B22', border: '1px solid #3A4050', borderRadius: 12, color: '#F2F4F7' }}
                        formatter={(v: number, name: string) => [money(v), name === 'actual' ? 'Balance' : 'Projected']} />
                    <ReferenceLine x={nowLabel} stroke="#3A4050" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="actual" stroke="#34D399" strokeWidth={3} fill="#34D399" fillOpacity={0.12} dot={false} connectNulls />
                    <Area type="monotone" dataKey="projected" stroke="#34D399" strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" fill="none" dot={false} connectNulls />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default BalanceChart;
