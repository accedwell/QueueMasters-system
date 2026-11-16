// Single source of truth for the service menu. Prices mirror BookingController.priceFor().
export const SERVICES = [
    {
        key: 'standard',
        name: 'Standard Wash',
        price: 100,
        minutes: 20,
        image: '/images/standard.jpg',
        tagline: 'The quick refresh',
        features: ['High-pressure exterior wash', 'Tyre shine', 'Windows inside & out', 'Hand dry'],
    },
    {
        key: 'valet',
        name: 'Full Valet',
        price: 350,
        minutes: 60,
        image: '/images/valet.jpg',
        tagline: 'Showroom, inside and out',
        popular: true,
        features: ['Everything in Standard', 'Interior deep clean & vacuum', 'Engine degrease', 'Wax & polish'],
    },
    {
        key: 'engine',
        name: 'Engine Clean',
        price: 150,
        minutes: 30,
        image: '/images/engine.jpg',
        tagline: 'Under-the-hood detail',
        features: ['Engine bay degrease', 'Low-pressure steam rinse', 'Plastics dressed', 'Protective coating'],
    },
];

export const STAGES = [
    { status: 'In Queue', label: 'Waiting', tone: 'waiting' },
    { status: 'Washing', label: 'Washing', tone: 'washing' },
    { status: 'Ready', label: 'Ready', tone: 'ready' },
];

export const serviceFor = (washType = '') => {
    const t = washType.toLowerCase();
    if (t.includes('valet')) return SERVICES[1];
    if (t.includes('engine')) return SERVICES[2];
    return SERVICES[0];
};

export const toneFor = (status) => (STAGES.find((s) => s.status === status) || STAGES[0]).tone;
export const labelFor = (status) => (STAGES.find((s) => s.status === status) || STAGES[0]).label;
