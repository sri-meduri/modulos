import { useWindowDimensions } from 'react-native';

/**
 * Layout rules. The same screens serve phones, tablets and desktop browsers:
 *   compact  (< 720)   one column, bottom tab bar
 *   medium   (< 1100)  two-column grids, bottom tab bar
 *   expanded (>= 1100) left sidebar, content column + side panels
 * Content is never stretched edge to edge: it is capped at `content.max`
 * and centered, so wide monitors don't show phone-sized screens or
 * over-stretched cards.
 */
export const breakpoints = { medium: 720, expanded: 1100 } as const;

export const layout = {
    gutter: { compact: 20, medium: 28, expanded: 40 },
    content: { max: 1080, narrow: 640 },
    sidebarWidth: 248,
    bottomBarHeight: 64,
    headerHeight: 56,
    /** Minimum column width used by <Grid>; columns wrap when they would be narrower. */
    gridMinColumn: 320,
} as const;

export type Size = 'compact' | 'medium' | 'expanded';

export const sizeFor = (width: number): Size =>
    width >= breakpoints.expanded ? 'expanded' : width >= breakpoints.medium ? 'medium' : 'compact';

export const useSize = (): { size: Size; width: number; isWide: boolean; gutter: number } => {
    const { width } = useWindowDimensions();
    const size = sizeFor(width);
    return { size, width, isWide: size === 'expanded', gutter: layout.gutter[size] };
};
