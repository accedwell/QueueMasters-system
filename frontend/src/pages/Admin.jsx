import React, { useMemo, useState } from 'react';
import api, { errorMessage } from '../api';
import usePolling from '../hooks/usePolling';
import Icon from '../components/Icon';
import Plate from '../components/Plate';
import { useFeedback } from '../components/Feedback';
import { STAGES, labelFor, toneFor, serviceFor } from '../data/services';
import { ago, rand, rand2, dateKey } from '../utils/format';

const FILTERS = [{ key: 'all', label: 'All' }, ...STAGES.map((s) => ({ key: s.status, label: s.label }))];
const NEXT_LABEL = { 'In Queue': 'Start wash', Washing: 'Mark ready' };

const Admin = ({ user }) => {
    const isAdmin = user?.role === 'ADMIN';
    const { toast, confirm } = useFeedback();
    const { data, error, loading, refresh } = usePolling(() => api.get('/bookings').then((r) => r.data), 5000, []);
    const cars = useMemo(() => data || [], [data]);

    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ plateNumber: '', carModel: '', phoneNumber: '' });
    const [busyId, setBusyId] = useState(null);

    const [archive, setArchive] = useState(null);
    const [archiveOpen, setArchiveOpen] = useState(false);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return cars
            .filter((c) => filter === 'all' || c.status === filter)
            .filter((c) => !q || [c.plateNumber, c.carModel, c.phoneNumber].some((v) => (v || '').toLowerCase().includes(q)));
    }, [cars, filter, query]);

    const count = (status) => cars.filter((c) => c.status === status).length;
    const queueValue = cars.reduce((s, c) => s + (c.amountPaid || serviceFor(c.washType).price), 0);

    const act = async (id, fn, okMsg) => {
        setBusyId(id);
        try {
            await fn();
            if (okMsg) toast(okMsg);
            await refresh();
        } catch (err) {
            toast(errorMessage(err), 'error', 'Action failed');
        } finally {
            setBusyId(null);
        }
    };

    const nextStage = (car) => act(car.id, () => api.put(`/bookings/${car.id}/next`),
        `${car.plateNumber} → ${car.status === 'In Queue' ? 'Washing' : 'Ready'}`);

    const saveEdit = (id) => act(id, async () => {
        await api.put(`/bookings/${id}`, editData);
        setEditingId(null);
    }, 'Vehicle details updated');

    const loadArchive = async () => {
        try {
            const { data: sales } = await api.get('/bookings/all-sales');
            setArchive(sales);
            setArchiveOpen(true);
        } catch (err) {
            toast(errorMessage(err), 'error', 'Could not load archive');
        }
    };

    const release = async (car) => {
        const ok = await confirm({
            title: `Release ${car.plateNumber}?`,
            message: `This hands the car back to the customer and records ${rand2(car.amountPaid)} in today's sales.`,
            confirmLabel: 'Release vehicle',
        });
        if (!ok) return;
        await act(car.id, () => api.delete(`/bookings/${car.id}/complete`), `${car.plateNumber} released. Sale recorded.`);
        if (archiveOpen) loadArchive();
    };

    const wipe = async () => {
        const ok = await confirm({
            title: 'Wipe the entire sales archive?',
            message: 'Every historical sale will be permanently deleted. Analytics will reset to zero. This cannot be undone.',
            confirmLabel: 'Wipe archive',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await api.delete('/bookings/clear-archive');
            setArchive([]);
            toast('Sales archive cleared', 'info');
        } catch (err) {
            toast(errorMessage(err), 'error', 'Wipe failed');
        }
    };

    const archiveTotal = (archive || []).reduce((s, x) => s + (x.amount || 0), 0);

    return (
        <div className="page">
            <header className="page-head">
                <div>
                    <span className="eyebrow">Operations</span>
                    <h1>Staff dashboard</h1>
                    <p className="muted">
                        Signed in as <b>{user.username}</b> · <span className={`role-badge role-${user.role.toLowerCase()}`}>{isAdmin ? 'Manager' : 'Washer'}</span>
                    </p>
                </div>
                <div className="row-actions">
                    <button className="btn btn-ghost" onClick={refresh}><Icon name="refresh" size={16} /> Refresh</button>
                    {isAdmin && (
                        <button className="btn btn-dark" onClick={archiveOpen ? () => setArchiveOpen(false) : loadArchive}>
                            <Icon name="archive" size={16} /> {archiveOpen ? 'Hide archive' : 'Sales archive'}
                        </button>
                    )}
                </div>
            </header>

            {error && (
                <div className="alert alert-error"><Icon name="wifiOff" size={18} /> {errorMessage(error)}</div>
            )}

            <div className="kpis">
                <div className="kpi tone-waiting"><span className="kpi-icon"><Icon name="clock" /></span><div><small>Waiting</small><b>{count('In Queue')}</b></div></div>
                <div className="kpi tone-washing"><span className="kpi-icon"><Icon name="droplet" /></span><div><small>Washing</small><b>{count('Washing')}</b></div></div>
                <div className="kpi tone-ready"><span className="kpi-icon"><Icon name="checkCircle" /></span><div><small>Ready</small><b>{count('Ready')}</b></div></div>
                <div className="kpi tone-money"><span className="kpi-icon"><Icon name="wallet" /></span><div><small>In the bay</small><b>{rand(queueValue)}</b></div></div>
            </div>

            <section className="card">
                <div className="toolbar">
                    <div className="tabs" role="tablist">
                        {FILTERS.map((f) => (
                            <button key={f.key} role="tab" aria-selected={filter === f.key} className={`tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                                {f.label}
                                <span className="tab-count">{f.key === 'all' ? cars.length : count(f.key)}</span>
                            </button>
                        ))}
                    </div>
                    <div className="input-icon search">
                        <Icon name="search" size={16} />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plate, model, phone…" />
                    </div>
                </div>

                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Vehicle</th>
                                <th>Service</th>
                                <th>Contact</th>
                                <th>Status</th>
                                <th className="right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && cars.length === 0 && (
                                <tr><td colSpan={5}><div className="skeleton" /><div className="skeleton" /></td></tr>
                            )}
                            {!loading && visible.length === 0 && (
                                <tr><td colSpan={5} className="empty">
                                    <Icon name="car" size={32} />
                                    <b>{cars.length === 0 ? 'The bay is empty' : 'No cars match'}</b>
                                    <span>{cars.length === 0 ? 'New bookings appear here automatically.' : 'Try a different filter or search.'}</span>
                                </td></tr>
                            )}
                            {visible.map((car) => {
                                const editing = editingId === car.id;
                                const busy = busyId === car.id;
                                return (
                                    <tr key={car.id} className={editing ? 'editing' : ''}>
                                        <td data-label="Vehicle">
                                            {editing ? (
                                                <div className="edit-stack">
                                                    <input aria-label="Plate" className="mono" value={editData.plateNumber} onChange={(e) => setEditData({ ...editData, plateNumber: e.target.value.toUpperCase() })} />
                                                    <input aria-label="Model" value={editData.carModel} onChange={(e) => setEditData({ ...editData, carModel: e.target.value })} />
                                                </div>
                                            ) : (
                                                <div className="veh">
                                                    <Plate size="sm">{car.plateNumber}</Plate>
                                                    <span>{car.carModel}<small>#{car.id}{car.createdAt ? ` · in ${ago(car.createdAt)}` : ''}</small></span>
                                                </div>
                                            )}
                                        </td>
                                        <td data-label="Service">
                                            <span className="svc">{car.washType}<small>{rand(car.amountPaid)}</small></span>
                                        </td>
                                        <td data-label="Contact">
                                            {editing ? (
                                                <input aria-label="Phone" value={editData.phoneNumber} onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })} />
                                            ) : car.phoneNumber ? (
                                                <a className="mono link" href={`tel:${car.phoneNumber}`}>{car.phoneNumber}</a>
                                            ) : <span className="muted">—</span>}
                                        </td>
                                        <td data-label="Status">
                                            <span className={`pill pill-${toneFor(car.status)}`}><span className="dot" />{labelFor(car.status)}</span>
                                        </td>
                                        <td className="right" data-label="">
                                            <div className="row-actions end">
                                                {editing ? (
                                                    <>
                                                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => saveEdit(car.id)}>Save</button>
                                                        <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {car.status !== 'Ready' && (
                                                            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => nextStage(car)}>
                                                                <Icon name="next" size={14} /> {NEXT_LABEL[car.status] || 'Next'}
                                                            </button>
                                                        )}
                                                        {isAdmin && car.status === 'Ready' && (
                                                            <button className="btn btn-sm btn-success" disabled={busy} onClick={() => release(car)}>
                                                                <Icon name="check" size={14} /> Release
                                                            </button>
                                                        )}
                                                        {isAdmin && (
                                                            <button className="icon-btn" title="Edit" aria-label="Edit vehicle" onClick={() => { setEditingId(car.id); setEditData({ plateNumber: car.plateNumber || '', carModel: car.carModel || '', phoneNumber: car.phoneNumber || '' }); }}>
                                                                <Icon name="edit" size={16} />
                                                            </button>
                                                        )}
                                                        {isAdmin && car.status !== 'Ready' && (
                                                            <button className="icon-btn" title="Release early" aria-label="Release vehicle" onClick={() => release(car)}>
                                                                <Icon name="logout" size={16} />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {isAdmin && archiveOpen && archive && (
                <section className="card archive">
                    <div className="card-head">
                        <div>
                            <h2>Sales archive</h2>
                            <p className="muted">{archive.length} sale{archive.length === 1 ? '' : 's'} · {rand2(archiveTotal)} total</p>
                        </div>
                        <div className="row-actions">
                            <button className="btn btn-sm btn-danger-soft" onClick={wipe} disabled={archive.length === 0}><Icon name="trash" size={14} /> Wipe archive</button>
                            <button className="icon-btn" aria-label="Close archive" onClick={() => setArchiveOpen(false)}><Icon name="x" size={16} /></button>
                        </div>
                    </div>
                    <div className="table-wrap">
                        <table className="table compact">
                            <thead><tr><th>Date</th><th>Plate</th><th>Service</th><th className="right">Revenue</th></tr></thead>
                            <tbody>
                                {archive.length === 0 && <tr><td colSpan={4} className="empty"><b>No sales recorded yet</b></td></tr>}
                                {archive.map((s) => (
                                    <tr key={s.id}>
                                        <td data-label="Date">{dateKey(s.date)}</td>
                                        <td data-label="Plate"><Plate size="sm">{s.plateNumber}</Plate></td>
                                        <td data-label="Service">{s.washType}</td>
                                        <td data-label="Revenue" className="right money">{rand2(s.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
};

export default Admin;
