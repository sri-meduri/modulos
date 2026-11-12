import { Platform, TextStyle } from 'react-native';

/** One typeface (Inter) in four weights. Loaded in app/_layout.tsx. */
export const fonts = {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
} as const;

type Weight = keyof typeof fonts;

interface Variant {
    size: number;
    line: number;
    weight: Weight;
    /** Tabular figures for money so columns line up. */
    numeric?: boolean;
}

/** The type scale. `<Text variant="...">` is the only way to render text. */
export const variants = {
    display: { size: 44, line: 50, weight: 'bold' },
    hero: { size: 36, line: 42, weight: 'bold', numeric: true },
    h1: { size: 28, line: 34, weight: 'bold' },
    h2: { size: 20, line: 26, weight: 'semibold' },
    h3: { size: 17, line: 24, weight: 'semibold' },
    stat: { size: 22, line: 28, weight: 'bold', numeric: true },
    body: { size: 16, line: 24, weight: 'regular' },
    bodyStrong: { size: 16, line: 24, weight: 'semibold' },
    small: { size: 14, line: 20, weight: 'regular' },
    smallStrong: { size: 14, line: 20, weight: 'semibold' },
    caption: { size: 12, line: 16, weight: 'regular' },
    captionStrong: { size: 12, line: 16, weight: 'semibold' },
    label: { size: 13, line: 18, weight: 'regular' },
    button: { size: 16, line: 20, weight: 'bold' },
    nav: { size: 11, line: 14, weight: 'medium' },
} as const satisfies Record<string, Variant>;

export type TextVariant = keyof typeof variants;

export const textStyle = (name: TextVariant): TextStyle => {
    const v: Variant = variants[name];
    return {
        fontFamily: fonts[v.weight],
        fontSize: v.size,
        lineHeight: v.line,
        ...(v.numeric ? { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } : null),
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    };
};
