import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Counts a number up to its new value (skipped when the user prefers reduced motion). */
export const useCountUp = (target: number, ms = 600): number => {
    const [value, setValue] = useState(target);
    const from = useRef(target);
    const reduce = useRef(false);
    useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(v => { reduce.current = v; }).catch(() => undefined); }, []);
    useEffect(() => {
        if (reduce.current || from.current === target) { setValue(target); from.current = target; return; }
        const start = Date.now();
        const a = from.current;
        let raf = 0;
        const tick = () => {
            const k = Math.min(1, (Date.now() - start) / ms);
            setValue(a + (target - a) * (1 - Math.pow(1 - k, 3)));
            if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, ms]);
    return value;
};
