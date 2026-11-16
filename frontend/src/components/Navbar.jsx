import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';

const Navbar = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);

    const overHero = pathname === '/' || pathname === '/tracker';

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    const logout = () => {
        onLogout();
        navigate('/login');
    };

    const role = user?.role;
    const solid = !overHero || scrolled || open;

    return (
        <header className={`nav ${solid ? 'nav-solid' : 'nav-clear'}`}>
            <div className="nav-inner">
                <Link to="/" className="brand" aria-label="QueueMasters home">
                    <span className="brand-mark"><Icon name="droplet" size={18} strokeWidth={2.4} /></span>
                    <span className="brand-name">Queue<b>Masters</b></span>
                </Link>

                <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
                    <Icon name={open ? 'x' : 'menu'} size={22} />
                </button>

                <nav className={`nav-links ${open ? 'open' : ''}`}>
                    <NavLink to="/" end>Home</NavLink>
                    <NavLink to="/book">Book a Wash</NavLink>
                    <NavLink to="/tracker">Live Queue</NavLink>
                    {role && <NavLink to="/admin">Dashboard</NavLink>}
                    {role === 'ADMIN' && (
                        <>
                            <NavLink to="/reports">Analytics</NavLink>
                            <NavLink to="/manage-staff">Staff</NavLink>
                        </>
                    )}
                    {!role ? (
                        <Link to="/login" className="btn btn-sm btn-glass nav-cta">
                            <Icon name="shield" size={16} /> Staff Login
                        </Link>
                    ) : (
                        <div className="nav-user">
                            <span className="nav-avatar" title={user.username}>{(user.username || '?')[0].toUpperCase()}</span>
                            <span className="nav-user-meta">
                                <b>{user.username}</b>
                                <small>{role === 'ADMIN' ? 'Manager' : 'Washer'}</small>
                            </span>
                            <button onClick={logout} className="btn btn-sm btn-glass" aria-label="Log out">
                                <Icon name="logout" size={16} />
                            </button>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Navbar;
