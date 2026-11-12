import React from 'react';
import { View } from 'react-native';
import { colors, layout, space, useSize } from '../../theme';

/** Full-width page section (marketing pages): background band + centered max-width content. */
export const Band: React.FC<{ children: React.ReactNode; alt?: boolean; narrow?: boolean; gap?: keyof typeof space }> = ({ children, alt, narrow, gap = 'xxl' }) => {
    const { gutter } = useSize();
    return (
        <View style={{ backgroundColor: alt ? colors.card : colors.bg, borderTopWidth: alt ? 1 : 0, borderBottomWidth: alt ? 1 : 0, borderColor: colors.border, paddingHorizontal: gutter, paddingVertical: space.giant + space.xxl }}>
            <View style={{ width: '100%', maxWidth: narrow ? layout.content.narrow : layout.content.max, alignSelf: 'center', gap: space[gap] }}>{children}</View>
        </View>
    );
};
