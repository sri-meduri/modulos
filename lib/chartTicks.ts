/** A labelled checkpoint on a chart's x axis: `at` is the data index it sits under. */
export interface XTick { at: number; label: string }

/** Picks up to `count` evenly spaced checkpoints from a list of labels (always including first and last). */
export const checkpoints = (labels: string[], count = 5): XTick[] => {
    if (labels.length === 0) return [];
    if (labels.length <= count) return labels.map((label, at) => ({ at, label }));
    return Array.from({ length: count }, (_, k) => {
        const at = Math.round((k * (labels.length - 1)) / (count - 1));
        return { at, label: labels[at] };
    });
};
