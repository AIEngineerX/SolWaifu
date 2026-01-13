/**
 * Netlify Serverless Function for Claude API
 * API key is stored in Netlify environment variables (secure)
 */

// Rate limiting store (note: resets on cold starts, consider Redis for production)
const rateLimitStore = new Map();

const RATE_LIMIT = {
    MAX_REQUESTS_PER_MINUTE: 20,
    MAX_REQUESTS_PER_HOUR: 100,
};

function checkRateLimit(ip) {
    const now = Date.now();
    const minute = 60 * 1000;
    const hour = 60 * minute;

    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, { requests: [] });
    }

    const data = rateLimitStore.get(ip);
    data.requests = data.requests.filter(time => now - time < hour);

    const requestsLastMinute = data.requests.filter(time => now - time < minute).length;
    const requestsLastHour = data.requests.length;

    if (requestsLastMinute >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
        return { allowed: false, reason: 'Too many requests. Chill for a minute, anon~ 💜' };
    }

    if (requestsLastHour >= RATE_LIMIT.MAX_REQUESTS_PER_HOUR) {
        return { allowed: false, reason: 'Hourly limit reached. Come back later, bestie~' };
    }

    data.requests.push(now);
    return { allowed: true };
}

export async function handler(event, context) {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    // Get client IP for rate limiting
    const clientIP = event.headers['x-forwarded-for']?.split(',')[0] ||
                    event.headers['client-ip'] || 'unknown';

    // Check rate limit
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
        return {
            statusCode: 429,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: rateCheck.reason }),
        };
    }

    // Get API key from environment variable (set in Netlify dashboard)
    const API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!API_KEY) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'API key not configured in Netlify environment' }),
        };
    }

    try {
        const { systemPrompt, messages } = JSON.parse(event.body);

        // Call Anthropic API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: systemPrompt,
                messages: messages,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('API Error:', error.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message }),
        };
    }
}
