import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import usePolling from '../hooks/usePolling';
import Icon from '../components/Icon';
import { SERVICES, serviceFor } from '../data/services';
import { rand, rand2, dateKey, localKey } from '../utils/format';

const RANGES = [7, 14, 30];

// Nice round axis max whose quarters are also round: 1, 2, 4, 6 or 8 times a power of ten.
const niceMax = (v) => {
    if (v <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 4, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
};

const Reports = () => {
    const [range, setRange] = useState(14);
    const [showTable, setShowTable] = useState(false);

    const { data, error, updatedAt } = usePolling(async () => {
        const [live, sales] = await Promise.all([api.get('/bookings'), api.get('/bookings/all-sales')]);
        return { live: live.data || [], sales: sales.data || [] };
    }, 8000, { live: [], sales: [] });

    const { live, sales } = data || { live: [], sales: [] };

    const stats = useMemo(() => {
        const todayKey = localKey(new Date());
        const today = sales.filter((s) => dateKey(s.date) === todayKey);
        const todayTotal = today.reduce((t, s) => t + (s.amount || 0), 0);
        const allTotal = sales.reduce((t, s) => t + (s.amount || 0), 0);
        const projected = live.reduce((t, c) => t + (c.amountPaid || serviceFor(c.washType).price), 0);

        // Daily revenue for the selected range (oldest -> newest), zero-filled.
        const byDay = {};
        sales.forEach((s) => { const k = dateKey(s.date); byDay[k] = (byDay[k] || 0) + (s.amount || 0); });
        const days = [];
        for (let i = range - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const k = localKey(d);
            days.push({ key: k, date: d, value: byDay[k] || 0, cars: sales.filter((s) => dateKey(s.date) === k).length });
        }

        // Service mix over all recorded sales, ranked by how many customers chose it.
        const mix = SERVICES.map((svc) => {
            const rows = sales.filter((s) => serviceFor(s.washType).key === svc.key);
            return { ...svc, count: rows.length, revenue: rows.reduce((t, s) => t + (s.amount || 0), 0), share: sales.length ? rows.length / sales.length : 0 };
        }).sort((a, b) => b.count - a.count || b.revenue - a.revenue);
        const favourite = mix[0] && mix[0].count > 0 ? mix[0] : null;

        const queueMix = SERVICES.map((svc) => ({ ...svc, count: live.filter((c) => serviceFor(c.washType).key === svc.key).length }));

        // Daily cash-up: every day that had a sale, newest first, with a per-service breakdown.
        const cashupMap = {};
        sales.forEach((s) => {
            const k = dateKey(s.date);
            if (!cashupMap[k]) cashupMap[k] = { key: k, cars: 0, total: 0, perService: Object.fromEntries(SERVICES.map((x) => [x.key, 0])) };
            const row = cashupMap[k];
            row.cars += 1;
            row.total += s.amount || 0;
            row.perService[serviceFor(s.washType).key] += 1;
        });
        if (!cashupMap[todayKey]) cashupMap[todayKey] = { key: todayKey, cars: 0, total: 0, perService: Object.fromEntries(SERVICES.map((x) => [x.key, 0])) };
        const cashup = Object.values(cashupMap).sort((a, b) => (a.key < b.key ? 1 : -1));

        return {
            todayTotal, todayCars: today.length, allTotal, projected, todayKey,
            avg: sales.length ? allTotal / sales.length : 0,
            days, mix, favourite, queueMix, cashup,
        };
    }, [live, sales, range]);

    const downloadCashup = () => {
        const head = ['Date', 'Cars', ...SERVICES.map((s) => s.name), 'Total (R)'];
        const rows = stats.cashup.map((d) => [d.key, d.cars, ...SERVICES.map((s) => d.perService[s.key]), d.total.toFixed(2)]);
        const csv = [head, ...rows].map((r) => r.join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url; a.download = `queuemasters-cashup-${stats.todayKey}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const peak = Math.max(...stats.days.map((d) => d.value), 0);
    const axisMax = niceMax(peak);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => axisMax * f);
    const rangeTotal = stats.days.reduce((t, d) => t + d.value, 0);
    const mixMax = Math.max(...stats.mix.map((m) => m.count), 1);
    const queueTotal = live.length;

    return (
        <div className="page">
            <header className="page-head">
                <div>
                    <span className="eyebrow">Witbank branch</span>
                    <h1>Analytics</h1>
                    <p className="muted">Live financial oversight{updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-ZA')}` : ''}</p>
                </div>
                <div className="row-actions">
                    <Link to="/admin" className="btn btn-ghost"><Icon name="grid" size={16} /> Dashboard</Link>
                </div>
            </header>

            {error && <div className="alert alert-error"><Icon name="wifiOff" size={18} /> {errorMessage(error)}</div>}

            <div className="stat-tiles">
                <div className="stat-tile hero-tile">
                    <small>Revenue today</small>
                    <b>{rand2(stats.todayTotal)}</b>
                    <span>{stats.todayCars} car{stats.todayCars === 1 ? '' : 's'} released · {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="stat-tile">
                    <small>In the bay now</small>
                    <b>{queueTotal}</b>
                    <span>{rand(stats.projected)} still to be released</span>
                </div>
                <div className="stat-tile fav-tile">
                    <small>Customers' favourite</small>
                    <b>{stats.favourite ? stats.favourite.name : '—'}</b>
                    <span>{stats.favourite ? `${stats.favourite.count} of ${sales.length} customers (${Math.round(stats.favourite.share * 100)}%)` : 'No sales yet'}</span>
                </div>
                <div className="stat-tile">
                    <small>All-time revenue</small>
                    <b>{rand(stats.allTotal)}</b>
                    <span>{sales.length} sale{sales.length === 1 ? '' : 's'} · avg {rand(stats.avg)} each</span>
                </div>
            </div>

            <div className="report-grid">
                <section className="card chart-card viz">
                    <div className="card-head">
                        <div>
                            <h2>Daily revenue</h2>
                            <p className="muted">{rand(rangeTotal)} over the last {range} days</p>
                        </div>
                        <div className="row-actions">
                            <div className="seg" role="group" aria-label="Date range">
                                {RANGES.map((r) => (
                                    <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}d</button>
                                ))}
                            </div>
                            <button className="btn btn-sm btn-ghost" onClick={() => setShowTable((s) => !s)}>{showTable ? 'Chart' : 'Table'}</button>
                        </div>
                    </div>

                    {showTable ? (
                        <div className="table-wrap">
                            <table className="table compact">
                                <thead><tr><th>Date</th><th className="right">Cars</th><th className="right">Revenue</th></tr></thead>
                                <tbody>
                                    {[...stats.days].reverse().map((d) => (
                                        <tr key={d.key}><td>{d.key}</td><td className="right">{d.cars}</td><td className="right">{rand2(d.value)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="colchart" role="img" aria-label={`Daily revenue for the last ${range} days, peak ${rand(peak)}`}>
                            <div className="colchart-grid">
                                {ticks.slice().reverse().map((t) => (
                                    <div key={t} className="gridline"><span>{t >= 1000 ? `R${+(t / 1000).toFixed(2)}k` : `R${t}`}</span></div>
                                ))}
                            </div>
                            <div className={`colchart-bars n${range}`}>
                                {stats.days.map((d, i) => {
                                    const isToday = i === stats.days.length - 1;
                                    const showLabel = range <= 14 || i % 5 === 0 || isToday;
                                    return (
                                        <div key={d.key} className="col" tabIndex={0}>
                                            <div className="col-track">
                                                {d.value > 0 && <div className="col-bar" style={{ height: `${(d.value / axisMax) * 100}%` }} />}
                                            </div>
                                            <div className="tip">
                                                <b>{rand2(d.value)}</b>
                                                <span>{d.date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })} · {d.cars} car{d.cars === 1 ? '' : 's'}</span>
                                            </div>
                                            <span className={`col-label ${isToday ? 'today' : ''}`}>
                                                {showLabel ? (isToday ? 'Today' : d.date.toLocaleDateString('en-ZA', range <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' })) : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {peak === 0 && <div className="chart-empty">No sales in this period yet. Release a car from the dashboard to see it here.</div>}
                        </div>
                    )}
                </section>

                <section className="card viz">
                    <div className="card-head"><div><h2>What customers choose</h2><p className="muted">Ranked by number of customers · all recorded sales</p></div></div>
                    <div className="hbars">
                        {stats.mix.map((m, i) => {
                            const colour = SERVICES.findIndex((s) => s.key === m.key) + 1;
                            return (
                                <div key={m.key} className="hbar" title={`${m.name}: ${m.count} customers, ${rand2(m.revenue)}`}>
                                    <div className="hbar-label">
                                        <span><i className={`swatch s${colour}`} /><em className="rank">#{i + 1}</em>{m.name}{i === 0 && m.count > 0 && <span className="fav-badge"><Icon name="star" size={11} /> Favourite</span>}</span>
                                        <b>{Math.round(m.share * 100)}%</b>
                                    </div>
                                    <div className="hbar-track">
                                        <div className={`hbar-fill s${colour}`} style={{ width: `${(m.count / mixMax) * 100}%` }} />
                                    </div>
                                    <small>{m.count} customer{m.count === 1 ? '' : 's'} · {rand(m.revenue)} revenue{stats.allTotal ? ` (${Math.round((m.revenue / stats.allTotal) * 100)}%)` : ''}</small>
                                </div>
                            );
                        })}
                    </div>

                    <div className="divider" />
                    <h3 className="mini-head">Current queue mix</h3>
                    {queueTotal === 0 ? (
                        <p className="muted small">The bay is empty right now.</p>
                    ) : (
                        <>
                            <div className="stackbar" aria-label="Current queue by service">
                                {stats.queueMix.filter((q) => q.count > 0).map((q) => (
                                    <div key={q.key} className={`stack-seg s${SERVICES.findIndex((s) => s.key === q.key) + 1}`} style={{ flexGrow: q.count }} title={`${q.name}: ${q.count}`} />
                                ))}
                            </div>
                            <ul className="legend">
                                {stats.queueMix.map((q, i) => (
                                    <li key={q.key}><i className={`swatch s${i + 1}`} />{q.name} <b>{q.count}</b></li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
            </div>

            <section className="card cashup">
                <div className="card-head">
                    <div><h2>Daily cash-up</h2><p className="muted">Total made each day, with how many of each wash were sold</p></div>
                    <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => window.print()}><Icon name="printer" size={14} /> Print</button>
                        <button className="btn btn-sm btn-primary" onClick={downloadCashup} disabled={sales.length === 0}><Icon name="download" size={14} /> Download CSV</button>
                    </div>
                </div>
                <div className="cashup-today">
                    <div>
                        <small>Today's cash-up · {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
                        <b>{rand2(stats.todayTotal)}</b>
                    </div>
                    <ul>
                        <li><b>{stats.todayCars}</b><span>car{stats.todayCars === 1 ? '' : 's'} released</span></li>
                        {SERVICES.map((s) => (
                            <li key={s.key}><b>{stats.cashup[0]?.perService[s.key] ?? 0}</b><span>{s.name}</span></li>
                        ))}
                        <li><b>{rand(stats.projected)}</b><span>still in the bay</span></li>
                    </ul>
                </div>
                <div className="table-wrap">
                    <table className="table compact">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th className="right">Cars</th>
                                {SERVICES.map((s) => <th key={s.key} className="right">{s.name}</th>)}
                                <th className="right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.cashup.slice(0, 31).map((d) => (
                                <tr key={d.key} className={d.key === stats.todayKey ? 'is-today' : ''}>
                                    <td data-label="Date">{d.key === stats.todayKey ? 'Today' : d.key}</td>
                                    <td data-label="Cars" className="right">{d.cars}</td>
                                    {SERVICES.map((s) => <td key={s.key} data-label={s.name} className="right">{d.perService[s.key] || '–'}</td>)}
                                    <td data-label="Total" className="right money">{rand2(d.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="card">
                <div className="card-head"><div><h2>Recent sales</h2><p className="muted">Latest released vehicles</p></div></div>
                <div className="table-wrap">
                    <table className="table compact">
                        <thead><tr><th>Date</th><th>Plate</th><th>Service</th><th className="right">Amount</th></tr></thead>
                        <tbody>
                            {sales.length === 0 && <tr><td colSpan={4} className="empty"><b>No sales yet</b><span>Released cars will show up here.</span></td></tr>}
                            {sales.slice(0, 8).map((s) => (
                                <tr key={s.id}>
                                    <td data-label="Date">{dateKey(s.date)}</td>
                                    <td data-label="Plate" className="mono">{s.plateNumber}</td>
                                    <td data-label="Service">{s.washType}</td>
                                    <td data-label="Amount" className="right money">{rand2(s.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default Reports;
