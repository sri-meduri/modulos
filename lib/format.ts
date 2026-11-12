export const money = (n: number, opts: { cents?: boolean } = {}): string =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0,
    }).format(Number.isFinite(n) ? n : 0);

export const pct = (fraction: number, digits = 0): string => `${(fraction * 100).toFixed(digits)}%`;

/** Parses user-typed money/number input; blank or invalid becomes 0 (never negative). */
export const toNumber = (text: string): number => Math.max(0, parseFloat(text) || 0);

const trimZero = (s: string): string => (s.endsWith('.0') ? s.slice(0, -2) : s);

/** Space-conscious money for chart axes and labels: $950, $2.5k, $25k, $1.2M. */
export const compactMoney = (n: number): string => {
    const v = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (v >= 1_000_000) return `${sign}$${trimZero((v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1))}M`;
    if (v >= 10_000) return `${sign}$${Math.round(v / 1000)}k`;
    if (v >= 1_000) return `${sign}$${trimZero((v / 1000).toFixed(1))}k`;
    return `${sign}$${Math.round(v)}`;
};

/** A few "nice" round tick values from 0 up to just above `max` (for example 0, 25k, 50k, 75k). */
export const niceTicks = (max: number, count = 4): number[] => {
    if (max <= 0) return [0];
    const rough = max / count;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= rough) ?? rough;
    const ticks: number[] = [];
    for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
    if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
};
