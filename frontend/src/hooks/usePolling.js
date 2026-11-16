import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Calls `fetcher` now and every `interval` ms. Pauses while the tab is hidden.
 * Returns { data, error, loading, refresh, updatedAt }.
 */
export default function usePolling(fetcher, interval = 5000, initial = null) {
    const [data, setData] = useState(initial);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(null);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const refresh = useCallback(async () => {
        try {
            const result = await fetcherRef.current();
            setData(result);
            setError(null);
            setUpdatedAt(new Date());
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        if (!interval) return undefined;
        const id = setInterval(() => {
            if (!document.hidden) refresh();
        }, interval);
        return () => clearInterval(id);
    }, [refresh, interval]);

    return { data, error, loading, refresh, updatedAt };
}
