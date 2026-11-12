/**
 * The ONE palette. Every color in the app comes from here.
 *
 * Brand colors are sampled from the Modulos logo (the eagle):
 *   aquamarine outline  #20F0C0  -> `accent`
 *   deep-teal head      #087870  -> `accentDeep`
 * The dark neutrals are tinted toward that teal so the logo, landing page and
 * app all sit on the same surface. Semantic meaning is fixed app-wide:
 *   accent = progress / savings / primary action
 *   amber  = interest / caution
 *   risk   = limits exceeded / destructive
 *
 * Do not write hex colors anywhere else (npm run check:theme enforces it).
 */
export const palette = {
    aqua: '#22F0C2',
    aquaPressed: '#19CFA6',
    teal: '#0A7C72',
    tealDark: '#0B3B38',
    ink: '#081211',
    amber: '#F5C26B',
    red: '#F87171',
    white: '#FFFFFF',
} as const;

export const colors = {
    /** App background. */
    bg: '#0A1313',
    /** Cards, sheets, inputs. */
    card: '#111D1D',
    /** Raised/hover surface, progress tracks, secondary chips. */
    surface: '#1A2B2B',
    /** Hairlines around cards. */
    border: '#1F3030',
    /** Stronger outlines (inputs, secondary buttons). */
    line: '#2E4646',
    /** Bottom bar / sidebar. */
    nav: '#0D1818',

    text: '#EAF6F4',
    /** Secondary text; 6.5:1 on `card`. */
    textMuted: '#8FA9A6',
    /** Text placed on `accent` fills. */
    onAccent: palette.ink,

    accent: palette.aqua,
    accentPressed: palette.aquaPressed,
    accentDeep: palette.teal,
    /** Tinted fills for "good" callouts and active badges. */
    accentTint: '#0E2A27',
    accentTintBorder: '#16504A',

    amber: palette.amber,
    amberTint: '#2A2410',
    amberTintBorder: '#4A3F1C',

    risk: palette.red,
    riskTint: '#321818',

    overlay: 'rgba(3, 9, 9, 0.7)',
    transparent: 'transparent',

    /** Categorical series (charts): first color is always the brand accent. */
    series: ['#22F0C2', '#F5C26B', '#60A5FA', '#C084FC', '#F472B6', '#94A3B8'] as readonly string[],
} as const;

export type ColorToken = Exclude<keyof typeof colors, 'series'>;
