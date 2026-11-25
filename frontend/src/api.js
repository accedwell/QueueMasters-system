import axios from 'axios';

// One place to change the backend address.
// - Development: `npm start` proxies /api to http://localhost:8080 (see "proxy" in package.json),
//   so there are no CORS problems and it also works when opened from another device on the network.
// - Production: /api uses the Node.js functions deployed with the frontend on Vercel.
//   REACT_APP_API_URL can optionally point to a separately hosted Java backend.
export const API_URL = (process.env.REACT_APP_API_URL || '').replace(/\/+$/, '')
    || '/api';

// Free hosting tiers put an idle backend to sleep; the first request after that can take ~30 s.
const api = axios.create({ baseURL: API_URL, timeout: process.env.NODE_ENV === 'development' ? 8000 : 40000 });

/** Turn any axios error into a short human sentence. */
export const errorMessage = (err, fallback = 'Something went wrong.') => {
    if (!err) return fallback;
    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || !err.response) {
        return process.env.NODE_ENV === 'development'
            ? 'Cannot reach the server. Is the backend running on port 8080?'
            : 'Cannot reach the server right now. Please try again in a moment.';
    }
    const data = err.response.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data.message === 'string') return data.message;
    return fallback;
};

export default api;
