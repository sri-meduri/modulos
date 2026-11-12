import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { compactMoney, niceTicks } from '../../lib/format';
import { checkpoints, XTick } from '../../lib/chartTicks';
import { Inline } from './Layout';
import { Text } from './Text';

export interface Series {
    /** One value per x position; null leaves a gap. */
    data: (number | null)[];
    color?: string;
    dashed?: boolean;
    fill?: boolean;
    width?: number;
}

export type { XTick };
export { checkpoints };

const PAD = { top: 10, bottom: 4, side: 6 };
const Y_GUTTER = 42;
const X_LABEL_H = 18;

const buildPaths = (data: (number | null)[], x: (i: number) => number, y: (v: number) => number, base: number) => {
    let line = '';
    let area = '';
    let run: { i: number; v: number }[] = [];
    const flush = () => {
        if (run.length === 0) return;
        line += run.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
        area += `M${x(run[0].i).toFixed(1)} ${base} ` + run.map(p => `L${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ') + ` L${x(run[run.length - 1].i).toFixed(1)} ${base} Z `;
        run = [];
    };
    data.forEach((v, i) => (v === null ? flush() : run.push({ i, v })));
    flush();
    return { line, area };
};

/**
 * Line / area chart on a shared x axis, with a rounded y axis ($25k, $50k…) and a
 * few labelled checkpoints along the bottom. `stacked` stacks the series.
 */
export const Chart: React.FC<{ series: Series[]; xTicks?: XTick[]; height?: number; stacked?: boolean; yAxis?: boolean; label: string }> = ({ series, xTicks, height = 160, stacked, yAxis = true, label }) => {
    const [width, setWidth] = useState(0);
    const n = Math.max(...series.map(s => s.data.length), 2);
    const sums = Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + (s.data[i] ?? 0), 0));
    const rawMax = Math.max(1, ...(stacked ? sums : series.flatMap(s => s.data.filter((v): v is number => v !== null))));
    const ticks = yAxis ? niceTicks(rawMax) : [0, rawMax];
    const max = ticks[ticks.length - 1] || rawMax;
    const left = yAxis ? Y_GUTTER : PAD.side;
    const plotH = height - PAD.top - PAD.bottom - (xTicks ? X_LABEL_H : 0);
    const x = (i: number) => left + (i / (n - 1)) * Math.max(1, width - left - PAD.side);
    const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
    const base = PAD.top + plotH;

    let cumulative: number[] = Array(n).fill(0);
    const drawn = series.map(s => {
        let data = s.data;
        if (stacked) {
            cumulative = cumulative.map((c, i) => c + (s.data[i] ?? 0));
            data = cumulative.slice();
        }
        return { s, ...buildPaths(data, x, y, base) };
    });

    return (
        <View accessibilityRole="image" accessibilityLabel={label} onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
            {width > 0 ? (
                <Svg width={width} height={height}>
                    {ticks.map(t => (
                        <React.Fragment key={t}>
                            <Line x1={left} x2={width - PAD.side} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
                            {yAxis ? <SvgText x={left - 6} y={y(t) + 4} fontSize={11} fontFamily={fonts.regular} fill={colors.textMuted} textAnchor="end">{compactMoney(t)}</SvgText> : null}
                        </React.Fragment>
                    ))}
                    {[...drawn].reverse().map(({ s, line, area }, k) => (
                        <React.Fragment key={k}>
                            {(s.fill || stacked) && area ? <Path d={area} fill={s.color ?? colors.accent} fillOpacity={stacked ? 0.35 : 0.14} /> : null}
                            {line ? <Path d={line} fill="none" stroke={s.color ?? colors.accent} strokeWidth={s.width ?? (stacked ? 1.5 : 3)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? '1 8' : undefined} /> : null}
                        </React.Fragment>
                    ))}
                    {(xTicks ?? []).map((t, k, all) => (
                        <SvgText key={`${t.at}-${k}`} x={x(t.at)} y={height - 3} fontSize={11} fontFamily={fonts.regular} fill={colors.textMuted}
                            textAnchor={k === 0 ? 'start' : k === all.length - 1 ? 'end' : 'middle'}>{t.label}</SvgText>
                    ))}
                </Svg>
            ) : null}
        </View>
    );
};

export const Legend: React.FC<{ items: { label: string; color: string; dashed?: boolean }[] }> = ({ items }) => (
    <Inline wrap gap="lg">
        {items.map(it => (
            <Inline key={it.label} gap="xs">
                <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: it.color }} />
                <Text variant="caption" color="textMuted">{it.label}</Text>
            </Inline>
        ))}
    </Inline>
);

/**
 * Grouped bars: each group has one value per series (e.g. income and bills by month).
 * Every bar is labelled with its (compact) amount so the numbers are readable at a glance.
 */
export const BarChart: React.FC<{ groups: { label: string; values: number[] }[]; colors: string[]; height?: number; label: string }> = ({ groups, colors: barColors, height = 170, label }) => {
    const [width, setWidth] = useState(0);
    const max = Math.max(1, ...groups.flatMap(g => g.values));
    const ticks = niceTicks(max, 3);
    const top = ticks[ticks.length - 1] || max;
    const plotH = height - PAD.top - X_LABEL_H - 14;
    const slot = width > 0 ? (width - Y_GUTTER - PAD.side) / Math.max(1, groups.length) : 0;
    const seriesCount = Math.max(1, barColors.length);
    const barW = Math.max(6, Math.min(26, (slot * 0.84) / seriesCount));
    const showValues = barW >= 14;
    return (
        <View accessibilityRole="image" accessibilityLabel={label} onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
            {width > 0 ? (
                <Svg width={width} height={height}>
                    {ticks.map(t => {
                        const yy = PAD.top + 14 + plotH - (t / top) * plotH;
                        return (
                            <React.Fragment key={t}>
                                <Line x1={Y_GUTTER} x2={width - PAD.side} y1={yy} y2={yy} stroke={colors.border} strokeWidth={1} />
                                <SvgText x={Y_GUTTER - 6} y={yy + 4} fontSize={11} fontFamily={fonts.regular} fill={colors.textMuted} textAnchor="end">{compactMoney(t)}</SvgText>
                            </React.Fragment>
                        );
                    })}
                    {groups.map((g, gi) => {
                        const cx = Y_GUTTER + gi * slot + slot / 2;
                        const x0 = cx - (barW * seriesCount) / 2;
                        return (
                            <React.Fragment key={g.label + gi}>
                                {g.values.map((v, si) => {
                                    const h = (v / top) * plotH;
                                    const bx = x0 + si * barW;
                                    const by = PAD.top + 14 + plotH - h;
                                    return (
                                        <React.Fragment key={si}>
                                            <Rect x={bx} y={by} width={barW - 2} height={Math.max(0, h)} rx={3} fill={barColors[si] ?? colors.accent} />
                                            {showValues ? <SvgText x={bx + (barW - 2) / 2} y={by - 4} fontSize={10} fontFamily={fonts.medium} fill={colors.text} textAnchor="middle">{compactMoney(v)}</SvgText> : null}
                                        </React.Fragment>
                                    );
                                })}
                                <SvgText x={cx} y={height - 3} fontSize={11} fontFamily={fonts.regular} fill={colors.textMuted} textAnchor="middle">{g.label}</SvgText>
                            </React.Fragment>
                        );
                    })}
                </Svg>
            ) : null}
        </View>
    );
};
