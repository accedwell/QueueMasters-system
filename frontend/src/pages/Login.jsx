import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import Icon from '../components/Icon';
import { useFeedback } from '../components/Feedback';

const Login = ({ onLogin }) => {
    const [creds, setCreds] = useState({ username: '', password: '' });
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useFeedback();

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const { data } = await api.post('/auth/login', creds);
            onLogin(data);
            toast(`Welcome back, ${data.username}.`, 'success');
            const from = location.state?.from;
            navigate(from || (data.role === 'ADMIN' ? '/reports' : '/admin'), { replace: true });
        } catch (err) {
            setError(err.response?.status === 401 ? 'Wrong username or password.' : errorMessage(err, 'Login failed.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth" style={{ backgroundImage: 'url(/images/login.jpg)' }}>
            <div className="auth-shade" />
            <div className="auth-inner">
                <div className="auth-copy">
                    <span className="eyebrow light">Staff portal</span>
                    <h1>Run the bay like clockwork.</h1>
                    <p>Move cars through the queue, release finished vehicles, and watch the day's revenue add up in real time.</p>
                    <ul className="checks light">
                        <li><Icon name="check" size={16} /> Live operations dashboard</li>
                        <li><Icon name="check" size={16} /> Sales analytics &amp; archive</li>
                        <li><Icon name="check" size={16} /> Role-based staff access</li>
                    </ul>
                </div>

                <form className="card auth-card" onSubmit={submit}>
                    <span className="auth-badge"><Icon name="shield" size={24} /></span>
                    <h2>Sign in</h2>
                    <p className="muted">Managers and washers only.</p>

                    {error && <div className="alert alert-error"><Icon name="x" size={16} /> {error}</div>}

                    <label className="field">
                        <span>Username</span>
                        <input autoFocus autoComplete="username" value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} placeholder="Enter username" required />
                    </label>
                    <label className="field">
                        <span>Password</span>
                        <div className="input-icon right">
                            <input type={show ? 'text' : 'password'} autoComplete="current-password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} placeholder="••••••••" required />
                            <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                                <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
                            </button>
                        </div>
                    </label>

                    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                        {busy ? <span className="spinner" /> : 'Secure login'}
                    </button>
                    <p className="hint">First time running the system? Sign in with <code>admin</code> / <code>admin@123</code>, then change it under Staff.</p>
                </form>
            </div>
        </div>
    );
};

export default Login;
