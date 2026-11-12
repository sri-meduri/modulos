import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, space } from '../../theme';
import { Text } from './Text';

export const ProgressBar: React.FC<{ value: number; tone?: 'accent' | 'amber'; label: string }> = ({ value, tone = 'accent', label }) => (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <View style={{ height: 8, borderRadius: 4, width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: tone === 'accent' ? colors.accent : colors.amber }} />
    </View>
);

/** Circular progress (percent paid). */
export const Ring: React.FC<{ value: number; label: string; size?: number }> = ({ value, label, size = 96 }) => {
    const r = size / 2 - 8;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, value));
    return (
        <View accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
                <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surface} strokeWidth={10} />
                <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.accent} strokeWidth={10} strokeLinecap="round"
                    strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </Svg>
            <Text variant="h3">{`${Math.round(v * 100)}%`}</Text>
        </View>
    );
};

/** Horizontal gauge with a limit marker (DTI against the risk-profile limit) and optional "today" tick. */
export const Gauge: React.FC<{ value: number; limit: number; max?: number; before?: number; tone?: 'accent' | 'amber' | 'risk'; label: string }> = ({ value, limit, max = 0.5, before, tone = 'accent', label }) => {
    const x = (v: number) => `${Math.min(1, Math.max(0, v / max)) * 100}%` as const;
    return (
        <View accessibilityRole="progressbar" accessibilityLabel={`${label}: ${Math.round(value * 100)}% of ${Math.round(limit * 100)}% limit`} style={{ gap: 6 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface }}>
                <View style={{ height: 8, borderRadius: 4, width: x(value), backgroundColor: colors[tone] }} />
                {before !== undefined ? <View style={{ position: 'absolute', top: -4, width: 2, height: 16, left: x(before), backgroundColor: colors.textMuted }} /> : null}
                <View style={{ position: 'absolute', top: -4, width: 2, height: 16, left: x(limit), backgroundColor: colors.risk }} />
            </View>
            <View style={{ height: 16 }}>
                <Text variant="caption" color="textMuted" style={{ position: 'absolute', left: 0 }}>0%</Text>
                <Text variant="caption" color="textMuted" style={{ position: 'absolute', left: x(limit), transform: [{ translateX: -28 }] }}>{`${Math.round(limit * 100)}% limit`}</Text>
                <Text variant="caption" color="textMuted" style={{ position: 'absolute', right: 0 }}>{`${Math.round(max * 100)}%`}</Text>
            </View>
        </View>
    );
};

/** Draggable slider that behaves identically on web and native. */
export const Slider: React.FC<{ value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string; valueText: string }> = ({ value, min, max, step, onChange, label, valueText }) => {
    const [width, setWidth] = useState(1);
    const latest = useRef({ width, min, max, step, onChange });
    latest.current = { width, min, max, step, onChange };
    const pan = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => set(e.nativeEvent.locationX),
        onPanResponderMove: e => set(e.nativeEvent.locationX),
    })).current;
    function set(x: number) {
        const { width: w, min: lo, max: hi, step: st, onChange: cb } = latest.current;
        const raw = lo + (Math.max(0, Math.min(w, x)) / w) * (hi - lo);
        cb(Math.max(lo, Math.min(hi, Math.round(raw / st) * st)));
    }
    const frac = (Math.max(min, Math.min(max, value)) - min) / Math.max(1, max - min);
    return (
        <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value, text: valueText }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={e => onChange(Math.max(min, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
            style={{ height: 36, justifyContent: 'center' }}>
            <View onLayout={e => setWidth(e.nativeEvent.layout.width || 1)} {...pan.panHandlers} style={{ height: 36, justifyContent: 'center' }}>
                <View pointerEvents="none" style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface }}>
                    <View style={{ height: 8, borderRadius: 4, width: `${frac * 100}%`, backgroundColor: colors.accent }} />
                </View>
                <View pointerEvents="none" style={{ position: 'absolute', left: `${frac * 100}%`, marginLeft: -12, width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.text }} />
            </View>
        </View>
    );
};

/** Step indicator: `total` segments, the first `current` filled. */
export const Steps: React.FC<{ total: number; current: number }> = ({ total, current }) => (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current }} accessibilityLabel={`Step ${current} of ${total}`} style={{ flexDirection: 'row', gap: space.sm }}>
        {Array.from({ length: total }, (_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: radius.sm, backgroundColor: i < current ? colors.accent : colors.surface }} />)}
    </View>
);

/** Round monogram. */
export const Avatar: React.FC<{ letter: string; size?: number }> = ({ letter, size = 48 }) => (
    <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentTintBorder, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="h3" color="accent">{letter}</Text>
    </View>
);
