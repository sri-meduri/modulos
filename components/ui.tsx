import React, { useEffect, useRef, useState } from 'react';

export const money = (n: number, opts: { cents?: boolean } = {}): string =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0,
    }).format(Number.isFinite(n) ? n : 0);

export const pct = (fraction: number, digits = 0): string => `${(fraction * 100).toFixed(digits)}%`;

/** Counts a number up when it changes (respects reduced motion). */
export const useCountUp = (target: number, ms = 600): number => {
    const [value, setValue] = useState(target);
    const from = useRef(target);
    useEffect(() => {
        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduce || from.current === target) { setValue(target); from.current = target; return; }
        const start = performance.now();
        const a = from.current;
        let raf = 0;
        const tick = (t: number) => {
            const k = Math.min(1, (t - start) / ms);
            setValue(a + (target - a) * (1 - Math.pow(1 - k, 3)));
            if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, ms]);
    return value;
};

export const PageTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
    <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-[34px] font-bold">{children}</h1>
        {right}
    </div>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { tone?: 'default' | 'mint' | 'amber' | 'outline' }> = ({ tone = 'default', className = '', ...rest }) => {
    const tones = {
        default: 'bg-dark-card border-dark-border',
        mint: 'bg-[#12211E] border-[#1F4A40]',
        amber: 'bg-[#2A2410] border-[#4A3F1C]',
        outline: 'bg-transparent border-dashed border-line',
    } as const;
    return <div {...rest} className={`rounded-2xl border p-4 ${tones[tone]} ${className}`} />;
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'lg' }> = ({ variant = 'primary', size = 'md', className = '', ...rest }) => {
    const v = {
        primary: 'bg-accent text-dark-bg hover:bg-accent-hover font-bold',
        secondary: 'border border-line text-dark-text hover:bg-surface-2 font-semibold',
        ghost: 'text-dark-text-secondary hover:text-dark-text font-medium',
        danger: 'border border-risk/60 text-risk hover:bg-risk/10 font-semibold',
    }[variant];
    const h = size === 'lg' ? 'h-[52px] text-base' : 'h-11 text-[15px]';
    return <button {...rest} className={`${h} rounded-xl px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${v} ${className}`} />;
};

export const Chip: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }> = ({ active, onClick, children, className = '' }) => (
    <button type="button" onClick={onClick} aria-pressed={active}
        className={`h-9 px-4 rounded-full text-sm font-semibold transition-colors ${active ? 'bg-accent text-dark-bg' : 'bg-dark-card border border-line text-[#D5DAE3] hover:bg-surface-2'} ${className}`}>
        {children}
    </button>
);

export const Badge: React.FC<{ tone?: 'gray' | 'mint' | 'amber' | 'red'; children: React.ReactNode }> = ({ tone = 'gray', children }) => {
    const t = {
        gray: 'bg-surface-2 text-dark-text-secondary',
        mint: 'bg-[#12302A] text-accent',
        amber: 'bg-[#3A2F14] text-amber',
        red: 'bg-[#3A1A1A] text-risk',
    }[tone];
    return <span className={`text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${t}`}>{children}</span>;
};

export const SegTabs = <T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
    <div role="tablist" aria-label={label} className="flex bg-dark-card border border-dark-border rounded-xl p-1 gap-1">
        {options.map(o => (
            <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
                className={`flex-1 h-9 rounded-[9px] text-sm font-semibold transition-colors ${value === o.value ? 'bg-accent text-dark-bg' : 'text-dark-text-secondary hover:text-dark-text'}`}>
                {o.label}
            </button>
        ))}
    </div>
);

interface FieldProps {
    label: string;
    hint?: string;
    prefix?: string;
    suffix?: string;
    value: number | string;
    onChange: (v: string) => void;
    type?: 'number' | 'text' | 'password';
    inputMode?: 'decimal' | 'numeric' | 'text';
    placeholder?: string;
    className?: string;
    id?: string;
    step?: string;
    readOnly?: boolean;
}

export const Field: React.FC<FieldProps> = ({ label, hint, prefix, suffix, value, onChange, type = 'number', inputMode = 'decimal', placeholder, className = '', id, step, readOnly }) => {
    const autoId = React.useId();
    const fid = id ?? autoId;
    return (
        <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
            <label htmlFor={fid} className="text-[13px] text-dark-text-secondary">{label}</label>
            <div className="flex items-center h-12 bg-dark-card border border-line rounded-xl px-3.5 focus-within:border-accent">
                {prefix && <span className="text-dark-text-secondary mr-1">{prefix}</span>}
                <input id={fid} type={type} inputMode={inputMode} value={value} readOnly={readOnly} step={step}
                    placeholder={placeholder} onChange={e => onChange(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent outline-none text-base tnum text-dark-text placeholder:text-dark-text-secondary/60" />
                {suffix && <span className="text-dark-text-secondary ml-1">{suffix}</span>}
            </div>
            {hint && <span className="text-xs text-dark-text-secondary">{hint}</span>}
        </div>
    );
};

export const ProgressBar: React.FC<{ value: number; tone?: 'mint' | 'amber'; label?: string }> = ({ value, tone = 'mint', label }) => (
    <div className="h-2 rounded bg-surface-2" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-2 rounded transition-[width] duration-500 ${tone === 'mint' ? 'bg-accent' : 'bg-amber'}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
);

/** Circular progress (percent paid). */
export const Ring: React.FC<{ value: number; size?: number; label: string }> = ({ value, size = 96, label }) => {
    const r = size / 2 - 8;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, value));
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="10" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-accent)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .6s ease' }} />
            <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.19} fontWeight="700" fill="var(--color-dark-text)">{Math.round(v * 100)}%</text>
        </svg>
    );
};

/** Horizontal gauge with a limit marker (DTI vs. risk-profile threshold). */
export const Gauge: React.FC<{ value: number; limit: number; max?: number; before?: number; tone?: 'mint' | 'amber' | 'red'; label: string }> = ({ value, limit, max = 0.5, before, tone = 'mint', label }) => {
    const x = (v: number) => `${Math.min(1, Math.max(0, v / max)) * 100}%`;
    const color = { mint: 'bg-accent', amber: 'bg-amber', red: 'bg-risk' }[tone];
    return (
        <div>
            <div className="relative h-2 rounded bg-surface-2" role="meter" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={Math.round(max * 100)}>
                <div className={`h-2 rounded transition-[width] duration-500 ${color}`} style={{ width: x(value) }} />
                {before !== undefined && <div className="absolute -top-1 w-0.5 h-4 bg-dark-text-secondary" style={{ left: x(before) }} title="Today" />}
                <div className="absolute -top-1 w-0.5 h-4 bg-risk" style={{ left: x(limit) }} title="Limit" />
            </div>
            <div className="relative h-4 mt-1 text-xs text-dark-text-secondary">
                <span className="absolute left-0">0%</span>
                <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: x(limit) }}>{Math.round(limit * 100)}% limit</span>
                <span className="absolute right-0">{Math.round(max * 100)}%</span>
            </div>
        </div>
    );
};

export const Sheet: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
                className="sheet-in w-full max-w-md max-h-[90vh] overflow-y-auto bg-dark-card border border-dark-border rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full text-dark-text-secondary hover:bg-surface-2">✕</button>
                </div>
                {children}
            </div>
        </div>
    );
};

export const Section: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
    <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            {right}
        </div>
        {children}
    </section>
);

export const Row: React.FC<{ label: React.ReactNode; value: React.ReactNode; strong?: boolean }> = ({ label, value, strong }) => (
    <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <span className="text-dark-text">{label}</span>
        <span className={`tnum ${strong ? 'font-semibold' : ''}`}>{value}</span>
    </div>
);

export const Icon: React.FC<{ d: string | string[]; className?: string }> = ({ d, className = 'w-6 h-6' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
        {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
    </svg>
);

export const ICONS = {
    overview: ['M3 11l9-7 9 7', 'M5 10v10h14V10'],
    debts: ['M3 8a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M3 10h18'],
    plan: ['M4 19V5', 'M4 19h16', 'M8 15l4-4 3 3 5-6'],
    budget: ['M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z', 'M4 7l12-3v3'],
    progress: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
    back: ['M15 6l-6 6 6 6'],
    chevron: ['M9 6l6 6-6 6'],
    check: ['M5 12l5 5 9-10'],
    bank: ['M3 10l9-6 9 6', 'M5 10v8M10 10v8M14 10v8M19 10v8', 'M3 20h18'],
    lock: ['M5 11h14v9H5z', 'M8 11V8a4 4 0 018 0v3'],
};
