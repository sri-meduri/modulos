import React from 'react';
import { View } from 'react-native';
import { border, colors, radius } from '../../theme';
import { Icon } from './Icon';

/** To-do style checkbox (display only): empty square, or a filled check when done. */
export const CheckMark: React.FC<{ checked: boolean; size?: number }> = ({ checked, size = 24 }) => (
    <View accessibilityRole="image" accessibilityLabel={checked ? 'Done' : 'Not done'}
        style={{ width: size, height: size, borderRadius: radius.sm, borderWidth: border.strong, borderColor: checked ? colors.accent : colors.line, backgroundColor: checked ? colors.accent : colors.transparent, alignItems: 'center', justifyContent: 'center' }}>
        {checked ? <Icon name="check" size={size - 8} color="onAccent" /> : null}
    </View>
);
