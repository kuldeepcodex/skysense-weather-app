/* =================================================================
   SkySense — Serverless Weather API Proxy (Vercel Serverless Function)
   Keeps the API key on the server side, never exposed to the client.
   Security: CORS restricted, input sanitized, IP rate-limited.
   ================================================================= */

// ── In-memory rate limiter (resets on cold-start, fine for serverless) ──
const rateLimitStore = new Map(); // ip → { count, resetAt }
const RATE_LIMIT = 30;            // max requests per window
const RATE_WINDOW = 60 * 1000;   // 1 minute window

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

// ── Input sanitisation ──
function sanitizeQuery(q) {
    if (typeof q !== 'string') return null;
    const cleaned = q.trim().replace(/[^a-zA-Z0-9 ,.-]/g, '');
    return cleaned.length > 0 && cleaned.length <= 100 ? cleaned : null;
}

export default async function handler(req, res) {
    // Handle CORS preflight
    setCORSHeaders(req, res);
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    const clientIp =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown';

    if (isRateLimited(clientIp)) {
        return res.status(429).json({
            error: 'Too many requests. Please wait a minute and try again.',
        });
    }

    // Read the API key from the Vercel environment variable
    const API_KEY = process.env.WEATHER_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({
            error: 'Server misconfiguration: WEATHER_API_KEY is not set.',
        });
    }

    // Extract & sanitise the query parameter
    const rawQ = req.query.q;
    const q = sanitizeQuery(rawQ);

    if (!q) {
        return res.status(400).json({
            error: 'Missing or invalid query parameter "q" (city name or lat,lon).',
        });
    }

    const days = Math.min(parseInt(req.query.days) || 6, 10);
    const aqi = req.query.aqi === 'yes' ? 'yes' : 'no';

    try {
        // Forward the request to WeatherAPI with the key kept server-side
        const apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(q)}&days=${days}&aqi=${aqi}&alerts=no`;
        const apiRes = await fetch(apiUrl);

        // Pass through any error status from WeatherAPI
        if (!apiRes.ok) {
            const errBody = await apiRes.json().catch(() => ({}));
            return res.status(apiRes.status).json(errBody);
        }

        const data = await apiRes.json();

        // Cache for 10 minutes at the CDN edge
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
        return res.status(200).json(data);
    } catch (err) {
        return res.status(502).json({
            error: 'Failed to reach weather service.',
            detail: err.message,
        });
    }
}
