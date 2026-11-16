import React from 'react';

/** A number plate styled like a South African registration plate. */
const Plate = ({ children, size = 'md' }) => (
    <span className={`plate plate-${size}`}>
        <span className="plate-flag" aria-hidden="true" />
        <span className="plate-text">{children || '—'}</span>
    </span>
);

export default Plate;
