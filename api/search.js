/* =================================================================
   SkySense — Serverless Search Autocomplete Proxy
   Security: CORS restricted, input sanitized, IP rate-limited.
   ================================================================= */

// ── Shared rate limiter (same logic as weather.js) ──
const rateLimitStore = new Map();
const RATE_LIMIT = 30;           // max requests per window
const RATE_WINDOW = 60 * 1000;

function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
        return false;
    }

    if (entry.count >= RATE_LIMIT) return true;
    entry.count++;
    return false;
}

const ALLOWED_ORIGINS = [
    'https://weather-app-ebon-chi-24.vercel.app'
];

function setCORSHeaders(req, res) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

function sanitizeQuery(q) {
    if (typeof q !== 'string') return null;
    const cleaned = q.trim().replace(/[^a-zA-Z0-9 ,.-]/g, '');
    return cleaned.length > 0 && cleaned.length <= 100 ? cleaned : null;
}

export default async function handler(req, res) {
    setCORSHeaders(req, res);
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const clientIp =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown';

    if (isRateLimited(clientIp)) {
        return res.status(429).json({
            error: 'Too many requests. Please wait a minute and try again.',
        });
    }

    const API_KEY = process.env.WEATHER_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({
            error: 'Server misconfiguration: WEATHER_API_KEY is not set.',
        });
    }

    const q = sanitizeQuery(req.query.q);

    if (!q) {
        return res.status(400).json({ error: 'Missing or invalid query parameter "q".' });
    }

    try {
        const apiUrl = `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(q)}`;
        const apiRes = await fetch(apiUrl);

        if (!apiRes.ok) {
            const errBody = await apiRes.json().catch(() => ({}));
            return res.status(apiRes.status).json(errBody);
        }

        const data = await apiRes.json();

        // Cache suggestions for 1 hour
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        return res.status(200).json(data);
    } catch (err) {
        return res.status(502).json({
            error: 'Failed to reach search service.',
            detail: err.message,
        });
    }
}
