import React from 'react';
import { Pressable, View, ViewProps } from 'react-native';
import { border, colors, radius, space } from '../../theme';
import { Text } from './Text';
import { PressState } from './press';

type Tone = 'default' | 'mint' | 'amber' | 'outline';

const padPx = { compact: space.md, default: space.lg, roomy: space.xxl } as const;

const tones: Record<Tone, { backgroundColor: string; borderColor: string; borderStyle?: 'dashed' }> = {
    default: { backgroundColor: colors.card, borderColor: colors.border },
    mint: { backgroundColor: colors.accentTint, borderColor: colors.accentTintBorder },
    amber: { backgroundColor: colors.amberTint, borderColor: colors.amberTintBorder },
    outline: { backgroundColor: colors.transparent, borderColor: colors.line, borderStyle: 'dashed' },
};

interface CardProps extends ViewProps {
    tone?: Tone;
    /** Highlight border (e.g. the recommended option). */
    accent?: boolean;
    /** compact = 12, default = 16, roomy = 24. */
    pad?: 'compact' | 'default' | 'roomy';
    padded?: boolean;
    onPress?: () => void;
    gap?: keyof typeof space;
}

export const Card: React.FC<CardProps> = ({ tone = 'default', accent, padded = true, pad = 'default', onPress, gap = 'md', style, children, ...rest }) => {
    const base = [
        { borderRadius: radius.lg, borderWidth: accent ? border.strong : border.hairline, padding: padded ? padPx[pad] : 0, gap: space[gap] },
        tones[tone],
        accent ? { borderColor: colors.accent } : null,
        style,
    ];
    if (onPress) {
        return (
            <Pressable accessibilityRole="button" onPress={onPress} style={(state) => { const { pressed, hovered } = state as PressState; return [...base, (pressed || hovered) ? { borderColor: colors.line } : null]; }}>
                {children}
            </Pressable>
        );
    }
    return <View {...rest} style={base}>{children}</View>;
};

const badgeTones = {
    gray: { bg: colors.surface, fg: 'textMuted' },
    mint: { bg: colors.accentTint, fg: 'accent' },
    amber: { bg: colors.amberTint, fg: 'amber' },
    red: { bg: colors.riskTint, fg: 'risk' },
} as const;

const solidFills = { gray: colors.surface, mint: colors.accent, amber: colors.amber, red: colors.risk } as const;

/** `solid` = filled pill with dark text (verdicts); default = tinted pill. */
export const Badge: React.FC<{ tone?: keyof typeof badgeTones; solid?: boolean; children: string }> = ({ tone = 'gray', solid, children }) => (
    <View style={{ backgroundColor: solid ? solidFills[tone] : badgeTones[tone].bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
        <Text variant="captionStrong" color={solid ? 'onAccent' : badgeTones[tone].fg} numberOfLines={1}>{children}</Text>
    </View>
);
