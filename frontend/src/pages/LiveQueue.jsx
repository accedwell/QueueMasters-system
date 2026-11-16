import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import usePolling from '../hooks/usePolling';
import Icon from '../components/Icon';
import Plate from '../components/Plate';
import { STAGES, serviceFor } from '../data/services';
import { ago } from '../utils/format';

const norm = (s = '') => s.replace(/\s+/g, '').toUpperCase();
const BAYS = 2;

const LANE_META = {
    waiting: { icon: 'clock', step: '01', sub: 'In line', empty: 'No cars waiting. Walk straight in!' },
    washing: { icon: 'droplet', step: '02', sub: 'In the bay', empty: 'The bays are free right now.' },
    ready: { icon: 'checkCircle', step: '03', sub: 'Collect at reception', empty: 'Nothing waiting for collection.' },
};

/** 0-100 estimate of how far a wash has progressed, based on check-in time and the service length. */
const progressOf = (car, nowMs) => {
    if (!car.createdAt) return null;
    const minutes = serviceFor(car.washType).minutes;
    const elapsed = (nowMs - new Date(car.createdAt).getTime()) / 60000;
    return Math.max(6, Math.min(96, Math.round((elapsed / minutes) * 100)));
};

const LiveQueue = () => {
    const [params, setParams] = useSearchParams();
    const highlight = norm(params.get('plate') || '');
    const [now, setNow] = useState(new Date());
    const { data, error, updatedAt } = usePolling(() => api.get('/bookings').then((r) => r.data), 5000, []);
    const cars = data || [];

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const waiting = cars.filter((c) => c.status === 'In Queue');
    const washing = cars.filter((c) => c.status === 'Washing');
    const workMinutes = waiting.reduce((s, c) => s + serviceFor(c.washType).minutes, 0)
        + washing.reduce((s, c) => s + serviceFor(c.washType).minutes / 2, 0);
    const waitEstimate = Math.round(workMinutes / BAYS);

    const mine = highlight ? cars.find((c) => norm(c.plateNumber) === highlight) : null;
    const mineStage = mine ? STAGES.findIndex((s) => s.status === mine.status) : -1;
    const minePosition = mine && mine.status === 'In Queue' ? waiting.findIndex((c) => c.id === mine.id) + 1 : 0;

    return (
        <div className="board" style={{ backgroundImage: 'url(/images/board.jpg)' }}>
            <div className="board-shade" />
            <div className="board-inner">
                <header className="board-head">
                    <div>
                        <span className={`live-pill ${error ? 'offline' : ''}`}>
                            <span className="dot" /> {error ? 'Reconnecting…' : 'Live'}
                        </span>
                        <h1>Live Wash Status</h1>
                        <p>Witbank Central · updates every 5 seconds</p>
                    </div>

                    <div className="board-summary">
                        <div>
                            <b>{cars.length}</b>
                            <span>{cars.length === 1 ? 'car on site' : 'cars on site'}</span>
                        </div>
                        <div>
                            <b>{waitEstimate === 0 ? 'None' : `~${waitEstimate}`}</b>
                            <span>{waitEstimate === 0 ? 'wait right now' : 'min wait for new arrivals'}</span>
                        </div>
                        <div className="board-clock">
                            <b>{now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</b>
                            <span>{now.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                        </div>
                    </div>
                </header>

                {highlight && (
                    <div className={`my-car ${mine ? `tone-${STAGES[mineStage].tone}` : 'tone-missing'}`}>
                        {mine ? (
                            <>
                                <Plate size="lg">{mine.plateNumber}</Plate>
                                <div className="my-car-text">
                                    <small>Your car · {mine.carModel} · {mine.washType}</small>
                                    <b>
                                        {mine.status === 'Ready' && 'Ready for collection! 🎉'}
                                        {mine.status === 'Washing' && 'Being washed right now'}
                                        {mine.status === 'In Queue' && (minePosition === 1 ? 'Next up — you are first in line' : `Waiting · position ${minePosition} in line`)}
                                    </b>
                                </div>
                                <ol className="stepper" aria-label="Progress">
                                    {STAGES.map((s, i) => (
                                        <li key={s.status} className={i < mineStage ? 'done' : i === mineStage ? 'now' : ''}>
                                            <span className="stepper-dot">{i < mineStage ? <Icon name="check" size={12} /> : i + 1}</span>
                                            <span className="stepper-label">{s.label}</span>
                                        </li>
                                    ))}
                                </ol>
                            </>
                        ) : (
                            <div className="my-car-text">
                                <small>Searching for {params.get('plate')}</small>
                                <b>Not on the board. It may already have been collected.</b>
                            </div>
                        )}
                        <button className="btn btn-sm btn-glass" onClick={() => setParams({})}><Icon name="x" size={14} /> Clear</button>
                    </div>
                )}

                {error && cars.length === 0 && (
                    <div className="board-offline">
                        <Icon name="wifiOff" size={28} />
                        <div><b>Can't reach the wash bay system</b><span>We'll reconnect automatically.</span></div>
                    </div>
                )}

                <div className="lanes">
                    {STAGES.map((stage) => {
                        const meta = LANE_META[stage.tone];
                        const lane = cars.filter((c) => c.status === stage.status);
                        return (
                            <section key={stage.status} className={`lane lane-${stage.tone}`}>
                                <header>
                                    <span className="lane-icon"><Icon name={meta.icon} size={22} /></span>
                                    <div className="lane-title">
                                        <small>Step {meta.step} · {meta.sub}</small>
                                        <h2>{stage.label}</h2>
                                    </div>
                                    <span className="lane-count">{lane.length}</span>
                                </header>

                                <div className="lane-body">
                                    {lane.length === 0 && (
                                        <div className="lane-empty">
                                            <span className="lane-empty-icon"><Icon name={meta.icon} size={28} /></span>
                                            <p>{meta.empty}</p>
                                        </div>
                                    )}
                                    {lane.map((car, i) => {
                                        const progress = stage.tone === 'washing' ? progressOf(car, now.getTime()) : null;
                                        return (
                                            <article
                                                key={car.id}
                                                className={`ticket ticket-${stage.tone} ${norm(car.plateNumber) === highlight ? 'is-mine' : ''}`}
                                                style={{ animationDelay: `${i * 60}ms` }}
                                            >
                                                {stage.tone === 'waiting' && (
                                                    <span className={`ticket-pos ${i === 0 ? 'next' : ''}`}>{i === 0 ? 'Next' : `#${i + 1}`}</span>
                                                )}
                                                <div className="ticket-main">
                                                    <Plate>{car.plateNumber}</Plate>
                                                    <div className="ticket-meta">
                                                        <span>{car.carModel}</span>
                                                        <small>
                                                            <em className="ticket-service">{car.washType}</em>
                                                            {car.createdAt && <> · {(() => { const a = ago(car.createdAt, now.getTime()); return a === 'just now' ? 'checked in just now' : `checked in ${a} ago`; })()}</>}
                                                        </small>
                                                    </div>
                                                    {stage.tone === 'ready' && (
                                                        <span className="ticket-tag ready"><Icon name="checkCircle" size={16} /> Collect now</span>
                                                    )}
                                                    {stage.tone === 'washing' && (
                                                        <span className="ticket-tag washing"><span className="spin-dot" /> In progress</span>
                                                    )}
                                                </div>
                                                {stage.tone === 'washing' && (
                                                    progress === null
                                                        ? <span className="wash-bar" />
                                                        : <span className="wash-progress"><span style={{ width: `${progress}%` }} /></span>
                                                )}
                                                {norm(car.plateNumber) === highlight && <span className="ticket-you">You</span>}
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>

                <footer className="board-foot">
                    <span>{updatedAt ? `Last updated ${updatedAt.toLocaleTimeString('en-ZA')}` : 'Connecting…'}</span>
                    <Link to="/book" className="board-foot-link">Not on the board yet? Book a wash <Icon name="arrowRight" size={14} /></Link>
                </footer>
            </div>
        </div>
    );
};

export default LiveQueue;
