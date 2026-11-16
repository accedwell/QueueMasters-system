import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api, { errorMessage } from '../api';
import Icon from '../components/Icon';
import Plate from '../components/Plate';
import { useFeedback } from '../components/Feedback';
import { SERVICES, serviceFor } from '../data/services';
import { rand } from '../utils/format';

// SA mobile: 0XX XXX XXXX or +27 XX XXX XXXX
const validPhone = (p) => /^(\+27|0)\d{9}$/.test(p.replace(/[\s-]/g, ''));

const Booking = () => {
    const location = useLocation();
    const { toast } = useFeedback();
    const initialService = SERVICES.some((s) => s.name === location.state?.selectedService)
        ? location.state.selectedService
        : SERVICES[0].name;

    const [form, setForm] = useState({ phoneNumber: '', plateNumber: '', carModel: '', washType: initialService });
    const [touched, setTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [ticket, setTicket] = useState(null);

    const set = (k) => (e) => setForm({ ...form, [k]: k === 'plateNumber' ? e.target.value.toUpperCase() : e.target.value });
    const selected = serviceFor(form.washType);
    const phoneBad = touched && !validPhone(form.phoneNumber);

    const submit = async (e) => {
        e.preventDefault();
        setTouched(true);
        if (!validPhone(form.phoneNumber)) {
            toast('Enter a valid South African number, e.g. 082 123 4567.', 'error', 'Check your phone number');
            return;
        }
        setSubmitting(true);
        try {
            const { data } = await api.post('/bookings', {
                ...form,
                plateNumber: form.plateNumber.trim(),
                carModel: form.carModel.trim(),
                phoneNumber: form.phoneNumber.replace(/[\s-]/g, ''),
            });
            setTicket(data);
            toast(`Ticket #${data.id} created.`, 'success', "You're in the queue!");
        } catch (err) {
            toast(errorMessage(err, 'Booking failed.'), 'error', 'Could not book');
        } finally {
            setSubmitting(false);
        }
    };

    if (ticket) {
        return (
            <div className="page narrow">
                <div className="ticket-done card">
                    <div className="done-icon"><Icon name="check" size={34} strokeWidth={3} /></div>
                    <span className="eyebrow">Booking confirmed</span>
                    <h1>You're in the queue</h1>
                    <p className="muted">Keep this ticket number. We'll let you know the moment your car is ready.</p>
                    <div className="ticket-stub">
                        <div><small>Ticket</small><b>#{ticket.id}</b></div>
                        <div><small>Vehicle</small><Plate>{ticket.plateNumber}</Plate></div>
                        <div><small>Service</small><b>{ticket.washType}</b></div>
                        <div><small>Paid</small><b>{rand(ticket.amountPaid)}</b></div>
                    </div>
                    <div className="row-actions center">
                        <Link to={`/tracker?plate=${encodeURIComponent(ticket.plateNumber)}`} className="btn btn-primary">
                            <Icon name="tv" size={18} /> Track my car
                        </Link>
                        <button className="btn btn-ghost" onClick={() => { setTicket(null); setTouched(false); setForm({ phoneNumber: '', plateNumber: '', carModel: '', washType: SERVICES[0].name }); }}>
                            Book another car
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="booking-layout">
                <aside className="booking-visual" style={{ backgroundImage: `url(${selected.image})` }}>
                    <div className="booking-visual-shade" />
                    <div className="booking-visual-copy">
                        <span className="eyebrow light">Witbank Premium Auto-Care</span>
                        <h2>{selected.name}</h2>
                        <p>{selected.tagline}</p>
                        <ul className="checks light">
                            {selected.features.map((f) => <li key={f}><Icon name="check" size={16} />{f}</li>)}
                        </ul>
                        <div className="visual-price">
                            <span>{rand(selected.price)}</span>
                            <small><Icon name="clock" size={14} /> about {selected.minutes} minutes</small>
                        </div>
                    </div>
                </aside>

                <form className="card booking-form" onSubmit={submit} noValidate={false}>
                    <h1>Book a wash</h1>
                    <p className="muted">Takes less than a minute. Pay on arrival at the bay.</p>

                    <fieldset className="service-picker">
                        <legend>Choose a service</legend>
                        {SERVICES.map((s) => (
                            <label key={s.key} className={`pick ${form.washType === s.name ? 'active' : ''}`}>
                                <input type="radio" name="washType" value={s.name} checked={form.washType === s.name} onChange={set('washType')} />
                                <span className="pick-thumb" style={{ backgroundImage: `url(${s.image})` }} />
                                <span className="pick-text"><b>{s.name}</b><small>~{s.minutes} min</small></span>
                                <span className="pick-price">{rand(s.price)}</span>
                            </label>
                        ))}
                    </fieldset>

                    <div className="field-row">
                        <label className="field">
                            <span>Number plate</span>
                            <input value={form.plateNumber} onChange={set('plateNumber')} placeholder="MP 123 GP" required maxLength={12} className="mono" />
                        </label>
                        <label className="field">
                            <span>Car make & model</span>
                            <input value={form.carModel} onChange={set('carModel')} placeholder="VW Golf 8" required maxLength={40} />
                        </label>
                    </div>

                    <label className={`field ${phoneBad ? 'invalid' : ''}`}>
                        <span>Cellphone (for your ready alert)</span>
                        <div className="input-icon">
                            <Icon name="phone" size={18} />
                            <input type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} onBlur={() => setTouched(true)} placeholder="082 123 4567" required />
                        </div>
                        {phoneBad && <small className="field-error">Use a 10-digit SA number, e.g. 082 123 4567</small>}
                    </label>

                    <div className="summary">
                        <span>Total due</span>
                        <b>{rand(selected.price)}</b>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
                        {submitting ? <span className="spinner" /> : <>Join the queue <Icon name="arrowRight" size={18} /></>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Booking;
