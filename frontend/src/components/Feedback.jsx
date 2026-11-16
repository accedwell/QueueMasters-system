import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Icon from './Icon';

// Toasts + a promise-based confirm dialog - replaces window.alert / window.confirm.
const FeedbackContext = createContext(null);

export const FeedbackProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [dialog, setDialog] = useState(null);
    const resolver = useRef(null);
    const idRef = useRef(0);

    const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

    const toast = useCallback((message, type = 'success', title) => {
        const id = ++idRef.current;
        setToasts((t) => [...t, { id, message, type, title }]);
        setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000);
    }, [dismiss]);

    const confirm = useCallback((opts) => new Promise((resolve) => {
        resolver.current = resolve;
        setDialog({ confirmLabel: 'Confirm', tone: 'primary', ...opts });
    }), []);

    const close = (answer) => {
        if (resolver.current) resolver.current(answer);
        resolver.current = null;
        setDialog(null);
    };

    return (
        <FeedbackContext.Provider value={{ toast, confirm }}>
            {children}

            <div className="toast-stack" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.type}`}>
                        <Icon name={t.type === 'error' ? 'x' : t.type === 'info' ? 'bell' : 'checkCircle'} size={18} />
                        <div>
                            {t.title && <strong>{t.title}</strong>}
                            <span>{t.message}</span>
                        </div>
                        <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                            <Icon name="x" size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {dialog && (
                <div className="modal-backdrop" onClick={() => close(false)}>
                    <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                        <h3>{dialog.title}</h3>
                        {dialog.message && <p>{dialog.message}</p>}
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => close(false)}>Cancel</button>
                            <button
                                autoFocus
                                className={`btn ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => close(true)}
                            >
                                {dialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </FeedbackContext.Provider>
    );
};

export const useFeedback = () => useContext(FeedbackContext);
