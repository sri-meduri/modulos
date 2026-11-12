import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors, ColorToken, IconName, icons } from '../../theme';

export const Icon: React.FC<{ name: IconName; size?: number; color?: ColorToken }> = ({ name, size = 24, color = 'text' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors[color]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {icons[name].map((d, i) => <Path key={i} d={d} />)}
    </Svg>
);
