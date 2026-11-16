import React from 'react';

/** Catches render errors so the user sees a friendly message instead of a blank page. */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('QueueMasters crashed:', error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="crash">
                <div className="card">
                    <h1>Something went wrong</h1>
                    <p className="muted">The page hit an unexpected error. Reloading usually fixes it.</p>
                    <pre>{String(this.state.error?.message || this.state.error)}</pre>
                    <div className="row-actions">
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
                        <button className="btn btn-ghost" onClick={() => { window.location.href = '/'; }}>Go home</button>
                    </div>
                </div>
            </div>
        );
    }
}
