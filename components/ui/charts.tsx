import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { colors } from '../../theme';
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

const PAD = { top: 8, bottom: 4, side: 4 };

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

/** Line / area chart on a shared x axis. Stack=true stacks the series. */
export const Chart: React.FC<{ series: Series[]; xLabels?: string[]; height?: number; stacked?: boolean; label: string }> = ({ series, xLabels, height = 150, stacked, label }) => {
    const [width, setWidth] = useState(0);
    const n = Math.max(...series.map(s => s.data.length), 2);
    const sums = Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + (s.data[i] ?? 0), 0));
    const max = Math.max(1, ...(stacked ? sums : series.flatMap(s => s.data.filter((v): v is number => v !== null))));
    const innerH = height - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.side + (i / (n - 1)) * Math.max(1, width - PAD.side * 2);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
    const base = PAD.top + innerH;

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
        <View accessibilityRole="image" accessibilityLabel={label} style={{ gap: 4 }}>
            <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
                {width > 0 ? (
                    <Svg width={width} height={height}>
                        {[0.25, 0.5, 0.75, 1].map(f => <Line key={f} x1={0} x2={width} y1={PAD.top + innerH * (1 - f)} y2={PAD.top + innerH * (1 - f)} stroke={colors.border} strokeWidth={1} />)}
                        {[...drawn].reverse().map(({ s, line, area }, k) => (
                            <React.Fragment key={k}>
                                {(s.fill || stacked) && area ? <Path d={area} fill={s.color ?? colors.accent} fillOpacity={stacked ? 0.35 : 0.14} /> : null}
                                {line ? <Path d={line} fill="none" stroke={s.color ?? colors.accent} strokeWidth={s.width ?? (stacked ? 1.5 : 3)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? '1 8' : undefined} /> : null}
                            </React.Fragment>
                        ))}
                    </Svg>
                ) : null}
            </View>
            {xLabels && xLabels.length > 0 ? (
                <Inline justify="space-between" gap="sm">
                    {xLabels.map((l, i) => <Text key={i} variant="caption" color="textMuted">{l}</Text>)}
                </Inline>
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
