import axios from 'axios';

// One place to change the backend address (or set REACT_APP_API_URL in .env).
// In development, `npm start` proxies /api to http://localhost:8080 (see "proxy" in package.json),
// so there are no CORS problems and it also works when opened from another device on the network.
export const API_URL = process.env.REACT_APP_API_URL
    || (process.env.NODE_ENV === 'development' ? '/api' : 'http://localhost:8080/api');

const api = axios.create({ baseURL: API_URL, timeout: 8000 });

/** Turn any axios error into a short human sentence. */
export const errorMessage = (err, fallback = 'Something went wrong.') => {
    if (!err) return fallback;
    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || !err.response) {
        return 'Cannot reach the server. Is the backend running on port 8080?';
    }
    const data = err.response.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data.message === 'string') return data.message;
    return fallback;
};

export default api;
