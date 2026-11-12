import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ColorToken, border, colors, hit, radius, space } from '../../theme';
import { Text } from './Text';
import { PressState } from './press';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const faces: Record<Variant, { bg: string; bgHover: string; borderColor: string; fg: ColorToken }> = {
    primary: { bg: colors.accent, bgHover: colors.accentPressed, borderColor: colors.accent, fg: 'onAccent' },
    secondary: { bg: colors.transparent, bgHover: colors.surface, borderColor: colors.line, fg: 'text' },
    ghost: { bg: colors.transparent, bgHover: colors.surface, borderColor: colors.transparent, fg: 'textMuted' },
    danger: { bg: colors.transparent, bgHover: colors.riskTint, borderColor: colors.risk, fg: 'risk' },
};

interface ButtonProps {
    children: string;
    onPress?: () => void;
    variant?: Variant;
    size?: 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    /** Size to its content instead of filling the row. */
    compact?: boolean;
    accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({ children, onPress, variant = 'primary', size = 'md', disabled, loading, compact, accessibilityLabel }) => {
    const f = faces[variant];
    return (
        <Pressable
            accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? children} accessibilityState={{ disabled: !!disabled || !!loading }}
            disabled={disabled || loading} onPress={onPress}
            style={(state) => { const { pressed, hovered } = state as PressState; return {
                minHeight: size === 'lg' ? hit.buttonLarge : hit.button, borderRadius: radius.md, paddingHorizontal: space.lg,
                borderWidth: variant === 'primary' ? 0 : border.hairline, borderColor: f.borderColor,
                backgroundColor: pressed || hovered ? f.bgHover : f.bg, opacity: disabled ? 0.45 : 1,
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm,
                alignSelf: compact ? 'flex-start' : 'stretch',
            }; }}>
            {loading ? <ActivityIndicator color={colors[f.fg]} /> : <Text variant={variant === 'primary' ? 'button' : 'bodyStrong'} color={f.fg} align="center" numberOfLines={1}>{children}</Text>}
        </Pressable>
    );
};

export const Chip: React.FC<{ children: string; active?: boolean; onPress?: () => void }> = ({ children, active, onPress }) => (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress}
        style={(state) => { const { hovered } = state as PressState; return {
            minHeight: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
            backgroundColor: active ? colors.accent : hovered ? colors.surface : colors.card,
            borderWidth: active ? 0 : border.hairline, borderColor: colors.line,
        }; }}>
        <Text variant="smallStrong" color={active ? 'onAccent' : 'text'}>{children}</Text>
    </Pressable>
);

export const SegTabs = <T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
    <View accessibilityRole="tablist" accessibilityLabel={label}
        style={{ flexDirection: 'row', backgroundColor: colors.card, borderWidth: border.hairline, borderColor: colors.border, borderRadius: radius.md, padding: space.xs, gap: space.xs }}>
        {options.map(o => (
            <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }} onPress={() => onChange(o.value)}
                style={{ flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: value === o.value ? colors.accent : colors.transparent }}>
                <Text variant="smallStrong" color={value === o.value ? 'onAccent' : 'textMuted'}>{o.label}</Text>
            </Pressable>
        ))}
    </View>
);

/** Inline text link/button. */
export const TextButton: React.FC<{ children: string; onPress?: () => void; color?: ColorToken }> = ({ children, onPress, color = 'accent' }) => (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}><Text variant="smallStrong" color={color}>{children}</Text></Pressable>
);
