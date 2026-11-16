import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

const Footer = () => (
    <footer className="footer">
        <div className="footer-inner">
            <div className="footer-brand">
                <Link to="/" className="brand">
                    <span className="brand-mark"><Icon name="droplet" size={18} strokeWidth={2.4} /></span>
                    <span className="brand-name">Queue<b>Masters</b></span>
                </Link>
                <p>Premium auto-care with a live queue you can actually see. No guessing, no waiting around.</p>
            </div>
            <div>
                <h4>Visit us</h4>
                <p><Icon name="pin" size={15} /> Witbank Central, eMalahleni</p>
                <p><Icon name="clock" size={15} /> Mon–Sat 07:00 – 18:00</p>
                <p><Icon name="clock" size={15} /> Sun 08:00 – 14:00</p>
            </div>
            <div>
                <h4>Explore</h4>
                <p><Link to="/book">Book a wash</Link></p>
                <p><Link to="/tracker">Live queue board</Link></p>
                <p><Link to="/login">Staff portal</Link></p>
            </div>
        </div>
        <div className="footer-base">© {new Date().getFullYear()} QueueMasters · Witbank Central Branch</div>
    </footer>
);

export default Footer;
