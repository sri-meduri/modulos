import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { colors, ColorToken, TextVariant, textStyle } from '../../theme';

export interface TextProps extends RNTextProps {
    variant?: TextVariant;
    color?: ColorToken;
    align?: TextStyle['textAlign'];
}

/** The only way to render text: typography and color come from the theme. */
export const Text: React.FC<TextProps> = ({ variant = 'body', color = 'text', align, style, ...rest }) => (
    <RNText {...rest} style={[textStyle(variant), { color: colors[color] }, align ? { textAlign: align } : null, style]} />
);
