/** 4-pt spacing scale. Use tokens, not numbers. */
export const space = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32, giant: 48 } as const;
export type Space = keyof typeof space;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export type Radius = keyof typeof radius;

export const border = { hairline: 1, strong: 1.5 } as const;

/** Minimum touch target (iOS/Android guidance and WCAG 2.5.5). */
export const hit = { min: 44, control: 48, button: 44, buttonLarge: 52 } as const;
