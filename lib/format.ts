export const money = (n: number, opts: { cents?: boolean } = {}): string =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0,
    }).format(Number.isFinite(n) ? n : 0);

export const pct = (fraction: number, digits = 0): string => `${(fraction * 100).toFixed(digits)}%`;

/** Parses user-typed money/number input; blank or invalid becomes 0 (never negative). */
export const toNumber = (text: string): number => Math.max(0, parseFloat(text) || 0);
