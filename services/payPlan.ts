import { Loan, PayoffStrategy } from '../types';
import { getEffectiveMinPayment } from './loanCalculator';
import { orderLoans } from './payoff';

export interface PlanPayment {
    loanId: string;
    name: string;
    /** Minimum plus any extra aimed at this debt. */
    amount: number;
    minimum: number;
    extra: number;
    /** Day of month it should arrive by (the debt's due day when known, else the 1st). */
    dayOfMonth: number;
    dueKnown: boolean;
    isFocus: boolean;
}

/**
 * Turns the plan into what to actually pay each month: every debt's minimum, plus
 * the whole extra on the focus debt (first in the chosen order).
 */
export const monthlyPaymentPlan = (loans: Loan[], extra: number, strategy: PayoffStrategy, customOrder: string[] = []): PlanPayment[] => {
    const ordered = orderLoans(loans, strategy, customOrder);
    return ordered.map((l, i) => {
        const minimum = getEffectiveMinPayment(l);
        const add = i === 0 ? Math.max(0, extra) : 0;
        return {
            loanId: l.id, name: l.name, minimum, extra: add, amount: Math.round((minimum + add) * 100) / 100,
            dayOfMonth: l.dueDay ?? 1, dueKnown: !!l.dueDay, isFocus: i === 0,
        };
    });
};

const escapeText = (s: string) => s.split('\\').join('\\\\').split(';').join('\\;').split(',').join('\\,').split('\n').join('\\n');
const stamp = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
const dollars = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/**
 * An iCalendar file with one monthly recurring reminder per debt ("Pay $X to Y"),
 * starting at the next occurrence of its day of the month, with a 2-day-ahead alert.
 */
export const paymentPlanCalendar = (payments: PlanPayment[], now: Date = new Date()): string => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Modulos//Payment plan//EN', 'CALSCALE:GREGORIAN'];
    for (const p of payments) {
        const day = Math.min(p.dayOfMonth, 28);
        let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
        if (start.getTime() < now.getTime() - 24 * 3600 * 1000) start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
        lines.push(
            'BEGIN:VEVENT',
            `UID:modulos-${p.loanId}@modulos.app`,
            `DTSTAMP:${stamp(now)}T000000Z`,
            `DTSTART;VALUE=DATE:${stamp(start)}`,
            'RRULE:FREQ=MONTHLY',
            `SUMMARY:${escapeText(`Pay ${dollars(p.amount)} to ${p.name}`)}`,
            `DESCRIPTION:${escapeText(p.extra > 0 ? `Minimum ${dollars(p.minimum)} plus ${dollars(p.extra)} extra (your Modulos plan).` : 'Minimum payment (your Modulos plan).')}`,
            'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Payment due soon', 'TRIGGER:-P2D', 'END:VALARM',
            'END:VEVENT'
        );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
};

const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'));

/** Plain-text version for the native share sheet. */
export const paymentPlanText = (payments: PlanPayment[]): string =>
    ['My Modulos monthly payment plan:', ...payments.map(p => `• ${p.name}: ${dollars(p.amount)}${p.extra > 0 ? ` (includes ${dollars(p.extra)} extra)` : ''} by the ${p.dayOfMonth}${ordinal(p.dayOfMonth)}`)].join('\n');
