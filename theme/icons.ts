/**
 * The ONE icon set: 24x24 grid, 2px round strokes, drawn with react-native-svg
 * by <Icon name="..."/>. Add icons here; never import another icon library.
 */
export const icons = {
    overview: ['M3 11l9-7 9 7', 'M5 10v10h14V10'],
    debts: ['M3 8a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M3 10h18'],
    plan: ['M4 19V5', 'M4 19h16', 'M8 15l4-4 3 3 5-6'],
    budget: ['M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z', 'M4 7l12-3v3'],
    progress: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
    profile: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 20a8 8 0 0116 0'],
    back: ['M15 6l-6 6 6 6'],
    chevron: ['M9 6l6 6-6 6'],
    chevronDown: ['M6 9l6 6 6-6'],
    check: ['M5 12l5 5 9-10'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    plus: ['M12 5v14', 'M5 12h14'],
    minus: ['M5 12h14'],
    trophy: ['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 01-10 0z', 'M17 5h3v2a3 3 0 01-3 3', 'M7 5H4v2a3 3 0 003 3'],
    target: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 16a4 4 0 100-8 4 4 0 000 8z', 'M12 12h.01'],
    flag: ['M5 21V4', 'M5 4h12l-2 4 2 4H5'],
    bank: ['M3 10l9-6 9 6', 'M5 10v8M10 10v8M14 10v8M19 10v8', 'M3 20h18'],
    lock: ['M5 11h14v9H5z', 'M8 11V8a4 4 0 018 0v3'],
    star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
    alert: ['M12 9v4', 'M12 17h.01', 'M10.3 4l-8 14a2 2 0 001.7 3h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z'],
    shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
    spark: ['M13 3L4 14h7l-1 7 9-11h-7z'],
    chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
    dollar: ['M12 3v18', 'M16 7H10a3 3 0 000 6h4a3 3 0 010 6H8'],
    cross: ['M6 6l12 12', 'M18 6L6 18'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof icons;
