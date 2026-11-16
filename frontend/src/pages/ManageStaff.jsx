import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import usePolling from '../hooks/usePolling';
import Icon from '../components/Icon';
import { useFeedback } from '../components/Feedback';
import { initials } from '../utils/format';

const ManageStaff = ({ user }) => {
    const { toast, confirm } = useFeedback();
    const { data, error, loading, refresh } = usePolling(() => api.get('/users').then((r) => r.data), 0, []);
    const staff = useMemo(() => data || [], [data]);

    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ username: '', role: 'WASHER', password: '' });

    // The founder is the first ADMIN ever created (lowest id) - protected on the server as well.
    const founderId = useMemo(() => {
        const admins = staff.filter((u) => u.role === 'ADMIN').sort((a, b) => a.id - b.id);
        return admins[0]?.id;
    }, [staff]);

    const sorted = useMemo(() => [...staff].sort((a, b) => (a.id === founderId ? -1 : b.id === founderId ? 1 : a.id - b.id)), [staff, founderId]);
    const admins = staff.filter((u) => u.role === 'ADMIN').length;

    const save = async (id) => {
        const payload = { username: editData.username, role: editData.role };
        if (editData.password) payload.password = editData.password;
        try {
            await api.put(`/users/${id}`, payload);
            setEditingId(null);
            toast('Staff member updated');
            refresh();
        } catch (err) {
            toast(errorMessage(err, 'Update failed'), 'error', 'Could not save');
        }
    };

    const remove = async (member) => {
        const ok = await confirm({
            title: `Remove ${member.username}?`,
            message: 'They will lose access to the staff portal immediately.',
            confirmLabel: 'Remove staff member',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await api.delete(`/users/${member.id}`);
            toast(`${member.username} removed`, 'info');
            refresh();
        } catch (err) {
            toast(errorMessage(err, 'Delete failed'), 'error', 'Could not remove');
        }
    };

    return (
        <div className="page">
            <header className="page-head">
                <div>
                    <span className="eyebrow">HR &amp; security</span>
                    <h1>Staff management</h1>
                    <p className="muted">{staff.length} team member{staff.length === 1 ? '' : 's'} · {admins} manager{admins === 1 ? '' : 's'} · {staff.length - admins} washer{staff.length - admins === 1 ? '' : 's'}</p>
                </div>
                <Link to="/signup" className="btn btn-primary"><Icon name="userPlus" size={16} /> Add staff</Link>
            </header>

            {error && <div className="alert alert-error"><Icon name="wifiOff" size={18} /> {errorMessage(error)}</div>}

            <div className="staff-grid">
                {loading && staff.length === 0 && [0, 1, 2].map((i) => <div key={i} className="card staff-card"><div className="skeleton" /><div className="skeleton" /></div>)}

                {sorted.map((m) => {
                    const isFounder = m.id === founderId;
                    const isMe = m.username === user?.username;
                    const editing = editingId === m.id;
                    return (
                        <article key={m.id} className={`card staff-card ${isFounder ? 'founder' : ''}`}>
                            <div className="staff-top">
                                <span className={`avatar ${m.role === 'ADMIN' ? 'avatar-admin' : ''}`}>{initials(m.username)}</span>
                                <div className="staff-id">
                                    {editing ? (
                                        <input aria-label="Username" value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} />
                                    ) : (
                                        <b>{m.username} {isMe && <span className="you">you</span>}</b>
                                    )}
                                    <small>Staff #{m.id}</small>
                                </div>
                            </div>

                            {editing ? (
                                <div className="staff-edit">
                                    <label className="field">
                                        <span>Role</span>
                                        <select value={editData.role} disabled={isFounder} onChange={(e) => setEditData({ ...editData, role: e.target.value })}>
                                            <option value="WASHER">Washer (yard &amp; operations)</option>
                                            <option value="ADMIN">Manager (admin &amp; finance)</option>
                                        </select>
                                    </label>
                                    <label className="field">
                                        <span>New password <em>(optional)</em></span>
                                        <input type="password" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} placeholder="Leave blank to keep" />
                                    </label>
                                    <div className="row-actions">
                                        <button className="btn btn-sm btn-primary" onClick={() => save(m.id)}>Save changes</button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="staff-foot">
                                    <div className="badges">
                                        <span className={`role-badge role-${m.role.toLowerCase()}`}>{m.role === 'ADMIN' ? 'Manager' : 'Washer'}</span>
                                        {isFounder && <span className="founder-badge" title="Founder: protected account"><Icon name="crown" size={13} /> Founder</span>}
                                    </div>
                                    <div className="row-actions">
                                        <button className="icon-btn" title="Edit" aria-label={`Edit ${m.username}`} onClick={() => { setEditingId(m.id); setEditData({ username: m.username, role: m.role, password: '' }); }}>
                                            <Icon name="edit" size={16} />
                                        </button>
                                        {!isFounder && !isMe && (
                                            <button className="icon-btn danger" title="Remove" aria-label={`Remove ${m.username}`} onClick={() => remove(m)}>
                                                <Icon name="trash" size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </article>
                    );
                })}

                <Link to="/signup" className="card staff-card add-card">
                    <Icon name="userPlus" size={28} />
                    <b>Add a team member</b>
                    <span>Create a washer or manager login</span>
                </Link>
            </div>
        </div>
    );
};

export default ManageStaff;
