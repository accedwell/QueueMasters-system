export const rand = (n) =>
    'R ' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const rand2 = (n) =>
    'R ' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Spring may send LocalDateTime as an ISO string or as [y,m,d,h,mi,s]. */
export const parseDate = (v) => {
    if (!v) return null;
    if (Array.isArray(v)) {
        const [y, m = 1, d = 1, h = 0, mi = 0, s = 0] = v;
        return new Date(y, m - 1, d, h, mi, s);
    }
    const d = new Date(v);
    return isNaN(d) ? null : d;
};

/** "LocalDate" as a yyyy-mm-dd key, whichever shape it arrives in. */
export const dateKey = (v) => {
    if (Array.isArray(v)) {
        const [y, m, d] = v;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return typeof v === 'string' ? v.slice(0, 10) : '';
};

export const localKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const minutesSince = (v, now = Date.now()) => {
    const d = parseDate(v);
    if (!d) return null;
    return Math.max(0, Math.round((now - d.getTime()) / 60000));
};

export const ago = (v, now) => {
    const m = minutesSince(v, now);
    if (m === null) return '';
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export const initials = (name = '') =>
    name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
