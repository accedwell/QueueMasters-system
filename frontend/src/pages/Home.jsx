import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import usePolling from '../hooks/usePolling';
import Icon from '../components/Icon';
import { SERVICES, serviceFor } from '../data/services';
import { rand } from '../utils/format';

const BAYS = 2; // wash bays working in parallel - used for the wait estimate

const estimateWait = (cars) => {
    const waiting = cars.filter((c) => c.status === 'In Queue');
    const washing = cars.filter((c) => c.status === 'Washing');
    const work = waiting.reduce((s, c) => s + serviceFor(c.washType).minutes, 0)
        + washing.reduce((s, c) => s + serviceFor(c.washType).minutes / 2, 0);
    return Math.round(work / BAYS);
};

const STEPS = [
    { icon: 'car', title: 'Check in', text: 'Book online or at the bay. Pick a service and leave your number.' },
    { icon: 'tv', title: 'Watch it live', text: 'Your plate moves across the live board from Waiting to Washing to Ready.' },
    { icon: 'bell', title: 'Get notified', text: 'We alert you the moment your car is ready, so you never wait around.' },
    { icon: 'sparkles', title: 'Drive off shining', text: 'Collect your car. Paid, polished and on your way.' },
];

const REVIEWS = [
    { name: 'Thabo M.', car: 'VW Polo GTI', text: 'I grabbed lunch, watched the board on my phone, and walked back the minute it said Ready. Brilliant.' },
    { name: 'Lerato K.', car: 'Toyota Fortuner', text: 'The full valet is unreal. The interior smelled brand new and the engine bay looked factory fresh.' },
    { name: 'Johan v.d. M.', car: 'Ford Ranger', text: 'No more standing around asking "how long still?" The live queue is a game changer.' },
];

const GALLERY = [
    { src: '/images/g-foam.jpg', title: 'Snow foam pre-wash', text: 'Lifts grit before a mitt ever touches the paint.', span: 'tall' },
    { src: '/images/g-wheel.jpg', title: 'Wheels & tyres', text: 'Iron fallout remover and a hand-brushed barrel clean.' },
    { src: '/images/g-polish.jpg', title: 'Paint correction', text: 'Machine polish for that deep, wet-look gloss.' },
    { src: '/images/g-interior.jpg', title: 'Interior detail', text: 'Leather cleaned, conditioned and protected.', span: 'wide' },
    { src: '/images/g-brush.jpg', title: 'Tyre dressing', text: 'Satin black finish, never greasy.' },
    { src: '/images/g-towel.jpg', title: 'Microfibre dry', text: 'Plush towels only - no swirl marks.' },
];

const Home = () => {
    const navigate = useNavigate();
    const [plate, setPlate] = useState('');
    const { data: cars, error } = usePolling(() => api.get('/bookings').then((r) => r.data), 10000, []);

    const list = cars || [];
    const online = !error;
    const wait = estimateWait(list);

    const track = (e) => {
        e.preventDefault();
        const p = plate.trim().toUpperCase();
        navigate(p ? `/tracker?plate=${encodeURIComponent(p)}` : '/tracker');
    };

    return (
        <div className="home">
            {/* ---------- HERO ---------- */}
            <section className="hero">
                <div className="photo-bg" style={{ backgroundImage: 'url(/images/hero.jpg)' }} />
                <div className="hero-shade" />
                <div className="bubbles" aria-hidden="true">
                    {Array.from({ length: 14 }).map((_, i) => (
                        <span key={i} style={{ '--i': i, '--s': `${8 + ((i * 7) % 34)}px`, '--d': `${11 + ((i * 1.3) % 9)}s` }} />
                    ))}
                </div>

                <div className="hero-content">
                    <span className={`live-pill ${online ? '' : 'offline'}`}>
                        <span className="dot" />
                        {online
                            ? (list.length === 0 ? 'No queue right now · walk straight in' : `${list.length} car${list.length === 1 ? '' : 's'} in the bay · ~${wait} min wait`)
                            : 'Witbank Central · Open today 07:00 – 18:00'}
                    </span>

                    <h1>
                        Showroom shine.<br />
                        <span className="grad-text">Zero guesswork.</span>
                    </h1>
                    <p className="hero-lead">
                        Premium hand wash and valet in Witbank, with a live queue board that shows you exactly
                        where your car is, from the first rinse to the final polish.
                    </p>

                    <div className="hero-actions">
                        <Link to="/book" className="btn btn-primary btn-lg">
                            Book a wash <Icon name="arrowRight" size={18} />
                        </Link>
                        <Link to="/tracker" className="btn btn-glass btn-lg">
                            <Icon name="tv" size={18} /> Live queue
                        </Link>
                    </div>

                    <form className="track-bar" onSubmit={track}>
                        <Icon name="search" size={18} />
                        <input
                            value={plate}
                            onChange={(e) => setPlate(e.target.value.toUpperCase())}
                            placeholder="Already here? Enter your plate, e.g. MP 123 GP"
                            aria-label="Number plate"
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Track</button>
                    </form>
                </div>

                <a href="#services" className="scroll-cue" aria-label="Scroll to services"><span /></a>
            </section>

            {/* ---------- SERVICES ---------- */}
            <section className="section" id="services">
                <div className="section-head">
                    <span className="eyebrow">Our services</span>
                    <h2>Pick your level of clean</h2>
                    <p>Transparent pricing. Every wash is done by hand by our trained team.</p>
                </div>

                <div className="service-grid">
                    {SERVICES.map((s) => (
                        <article key={s.key} className={`service-card ${s.popular ? 'popular' : ''}`}>
                            <div className="service-media" style={{ backgroundImage: `url(${s.image})` }}>
                                {s.popular && <span className="ribbon">Most popular</span>}
                                <span className="service-time"><Icon name="clock" size={14} /> ~{s.minutes} min</span>
                            </div>
                            <div className="service-body">
                                <span className="service-tag">{s.tagline}</span>
                                <div className="service-title">
                                    <h3>{s.name}</h3>
                                    <span className="price">{rand(s.price)}</span>
                                </div>
                                <ul className="checks">
                                    {s.features.map((f) => <li key={f}><Icon name="check" size={16} />{f}</li>)}
                                </ul>
                                <button
                                    className={`btn ${s.popular ? 'btn-primary' : 'btn-outline'} btn-block`}
                                    onClick={() => navigate('/book', { state: { selectedService: s.name } })}
                                >
                                    Choose {s.name}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* ---------- HOW IT WORKS ---------- */}
            <section className="section section-tint">
                <div className="section-head">
                    <span className="eyebrow">How it works</span>
                    <h2>From dusty to dazzling in four steps</h2>
                </div>
                <div className="steps">
                    {STEPS.map((s, i) => (
                        <div key={s.title} className="step">
                            <span className="step-num">0{i + 1}</span>
                            <span className="step-icon"><Icon name={s.icon} size={26} /></span>
                            <h3>{s.title}</h3>
                            <p>{s.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ---------- SHOWCASE ---------- */}
            <section className="showcase">
                <div className="photo-bg fixed" style={{ backgroundImage: 'url(/images/cta.jpg)' }} />
                <div className="showcase-shade" />
                <div className="showcase-inner">
                    <div className="showcase-copy">
                        <span className="eyebrow light">The QueueMasters difference</span>
                        <h2>Your time matters as much as your paintwork.</h2>
                        <p>
                            Our live board turns the car wash into a no-stress stop. Check in, go about your day,
                            and come back to a car that looks like it just left the showroom.
                        </p>
                        <Link to="/tracker" className="btn btn-glass btn-lg"><Icon name="tv" size={18} /> Open the live board</Link>
                    </div>
                    <div className="feature-list">
                        <div><Icon name="droplet" size={22} /><b>pH-neutral snow foam</b><span>Safe on wax, ceramic and wraps</span></div>
                        <div><Icon name="clock" size={22} /><b>Real-time status</b><span>Updated live by the wash team</span></div>
                        <div><Icon name="shield" size={22} /><b>Paid up front</b><span>No surprises when you collect</span></div>
                        <div><Icon name="sparkles" size={22} /><b>Hand finished</b><span>Every car dried and inspected</span></div>
                    </div>
                </div>
            </section>

            {/* ---------- GALLERY ---------- */}
            <section className="section gallery-section">
                <div className="section-head">
                    <span className="eyebrow">Detail is everything</span>
                    <h2>Obsessive about the finish</h2>
                    <p>Every car gets the same treatment we'd give our own. Here's what happens in the bay.</p>
                </div>
                <div className="gallery">
                    {GALLERY.map((g) => (
                        <figure key={g.title} className={`gallery-item ${g.span || ''}`}>
                            <img src={g.src} alt={g.title} loading="lazy" />
                            <figcaption>
                                <b>{g.title}</b>
                                <span>{g.text}</span>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            {/* ---------- REVIEWS ---------- */}
            <section className="section">
                <div className="section-head">
                    <span className="eyebrow">Loved in Witbank</span>
                    <h2>Don't just take our word for it</h2>
                </div>
                <div className="reviews">
                    {REVIEWS.map((r) => (
                        <figure key={r.name} className="review">
                            <div className="stars">{Array.from({ length: 5 }).map((_, i) => <Icon key={i} name="star" size={16} />)}</div>
                            <blockquote>“{r.text}”</blockquote>
                            <figcaption><b>{r.name}</b><span>{r.car}</span></figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            {/* ---------- CTA ---------- */}
            <section
                className="cta-band"
                style={{ backgroundImage: 'linear-gradient(90deg, rgba(10,10,10,.95) 0%, rgba(10,10,10,.7) 38%, rgba(10,10,10,0) 70%), url(/images/promo.jpg)' }}
            >
                <div>
                    <span className="eyebrow light">Book in 60 seconds</span>
                    <h2>Ready for that new-car feeling?</h2>
                    <p>Book in under a minute. We'll take it from here.</p>
                </div>
                <Link to="/book" className="btn btn-primary btn-lg">Book your wash <Icon name="arrowRight" size={18} /></Link>
            </section>
        </div>
    );
};

export default Home;
