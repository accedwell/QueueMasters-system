import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import Icon from '../components/Icon';
import { useFeedback } from '../components/Feedback';

const ROLES = [
    { value: 'WASHER', title: 'Washer', text: 'Moves cars through the wash stages.', icon: 'droplet' },
    { value: 'ADMIN', title: 'Manager', text: 'Full access: releases, analytics, staff.', icon: 'shield' },
];

// Only reachable by ADMINs - App.js wraps this route in ProtectedRoute.
const Signup = () => {
    const [form, setForm] = useState({ username: '', password: '', role: 'WASHER' });
    const [busy, setBusy] = useState(false);
    const { toast } = useFeedback();
    const navigate = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        if (form.password.length < 6) {
            toast('Use at least 6 characters.', 'error', 'Password too short');
            return;
        }
        setBusy(true);
        try {
            await api.post('/auth/register', { ...form, username: form.username.trim() });
            toast(`${form.username} can now sign in.`, 'success', `${form.role === 'ADMIN' ? 'Manager' : 'Washer'} account created`);
            navigate('/manage-staff');
        } catch (err) {
            toast(errorMessage(err, 'Registration failed.'), 'error', 'Could not create account');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="page narrow">
            <Link to="/manage-staff" className="back-link"><Icon name="arrowRight" size={16} className="flip" /> Back to staff</Link>
            <form className="card form-card" onSubmit={submit}>
                <span className="auth-badge"><Icon name="userPlus" size={24} /></span>
                <h1>Register new staff</h1>
                <p className="muted">Create a login for a new team member.</p>

                <label className="field">
                    <span>Username</span>
                    <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. sipho_w" required autoComplete="off" />
                </label>
                <label className="field">
                    <span>Password</span>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" required autoComplete="new-password" />
                </label>

                <fieldset className="role-picker">
                    <legend>Access level</legend>
                    {ROLES.map((r) => (
                        <label key={r.value} className={`pick ${form.role === r.value ? 'active' : ''}`}>
                            <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                            <span className="pick-icon"><Icon name={r.icon} size={20} /></span>
                            <span className="pick-text"><b>{r.title}</b><small>{r.text}</small></span>
                        </label>
                    ))}
                </fieldset>

                <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                    {busy ? <span className="spinner" /> : 'Create account'}
                </button>
            </form>
        </div>
    );
};

export default Signup;
