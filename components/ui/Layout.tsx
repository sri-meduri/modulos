import React from 'react';
import { ScrollView, View, ViewProps, ViewStyle } from 'react-native';
import { Space, colors, layout, space, useSize } from '../../theme';
import { Text } from './Text';

/** Scrollable page body: gutters, centered max-width column, consistent vertical rhythm. */
export const Screen: React.FC<{ children: React.ReactNode; narrow?: boolean; footer?: React.ReactNode }> = ({ children, narrow, footer }) => {
    const { gutter } = useSize();
    return (
        <View style={{ flex: 1 }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: space.xxl, paddingBottom: space.giant }}>
                <View style={{ width: '100%', maxWidth: narrow ? layout.content.narrow : layout.content.max, alignSelf: 'center', gap: space.lg }}>
                    {children}
                </View>
            </ScrollView>
            {footer}
        </View>
    );
};

interface StackProps extends ViewProps { gap?: Space; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent'] }

/** Vertical layout with token gaps. */
export const Stack: React.FC<StackProps> = ({ gap = 'md', align, justify, style, ...rest }) => (
    <View {...rest} style={[{ gap: space[gap], alignItems: align, justifyContent: justify }, style]} />
);

/** Horizontal layout with token gaps. */
export const Inline: React.FC<StackProps & { wrap?: boolean }> = ({ gap = 'md', align = 'center', justify, wrap, style, ...rest }) => (
    <View {...rest} style={[{ flexDirection: 'row', gap: space[gap], alignItems: align, justifyContent: justify, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]} />
);

/**
 * Responsive grid: children sit side by side and wrap to a single column
 * when they would get narrower than `min`. This is how phone layouts stack and
 * desktop layouts use their width.
 */
export const Grid: React.FC<{ children: React.ReactNode; min?: number; gap?: Space }> = ({ children, min = layout.gridMinColumn, gap = 'lg' }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[gap] }}>
        {React.Children.toArray(children).map((child, i) => (
            <View key={i} style={{ flexGrow: 1, flexShrink: 1, flexBasis: min, minWidth: 0, gap: space[gap] }}>{child}</View>
        ))}
    </View>
);

export const PageTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
    <Inline justify="space-between" gap="md">
        <Text variant="h1" accessibilityRole="header" style={{ flexShrink: 1 }}>{children}</Text>
        {right}
    </Inline>
);

export const Section: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
    <Stack gap="md">
        <Inline justify="space-between">
            <Text variant="h3" accessibilityRole="header">{title}</Text>
            {right}
        </Inline>
        {children}
    </Stack>
);

/** Label on the left, value on the right. */
export const Row: React.FC<{ label: React.ReactNode; value: React.ReactNode; strong?: boolean }> = ({ label, value, strong }) => (
    <Inline justify="space-between" align="flex-start" gap="md">
        <View style={{ flexShrink: 1 }}>{typeof label === 'string' ? <Text>{label}</Text> : label}</View>
        {typeof value === 'string' ? <Text variant={strong ? 'bodyStrong' : 'body'} style={{ fontVariant: ['tabular-nums'], flexShrink: 0 }}>{value}</Text> : value}
    </Inline>
);

export const Divider: React.FC = () => <View style={{ height: 1, backgroundColor: colors.border }} />;
