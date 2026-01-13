/**
 * Degen Waifu - Proxy Server for Claude API
 *
 * This server handles CORS issues when calling the Anthropic API from the browser.
 * Run with: node server.js
 *
 * Set your API key:
 *   Option 1: Environment variable - ANTHROPIC_API_KEY=sk-ant-xxx node server.js
 *   Option 2: Edit the API_KEY constant below
 */

import http from 'http';
import https from 'https';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;

// ============================================================
// 🔑 PUT YOUR ANTHROPIC API KEY HERE (or use environment variable)
// ============================================================
const API_KEY = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE';
// ============================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ============================================================
// 🛡️ RATE LIMITING CONFIG (protect your API key from abuse)
// ============================================================
const RATE_LIMIT = {
    MAX_REQUESTS_PER_MINUTE: 20,    // Max requests per IP per minute
    MAX_REQUESTS_PER_HOUR: 100,     // Max requests per IP per hour
};

// Rate limit tracking
const rateLimitStore = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const minute = 60 * 1000;
    const hour = 60 * minute;

    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, { requests: [] });
    }

    const data = rateLimitStore.get(ip);

    // Clean old requests
    data.requests = data.requests.filter(time => now - time < hour);

    // Count recent requests
    const requestsLastMinute = data.requests.filter(time => now - time < minute).length;
    const requestsLastHour = data.requests.length;

    if (requestsLastMinute >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
        return { allowed: false, reason: 'Too many requests. Chill for a minute, anon~ 💜' };
    }

    if (requestsLastHour >= RATE_LIMIT.MAX_REQUESTS_PER_HOUR) {
        return { allowed: false, reason: 'Hourly limit reached. Come back later, bestie~' };
    }

    // Record this request
    data.requests.push(now);
    return { allowed: true };
}

// Clean up rate limit store periodically
setInterval(() => {
    const hour = 60 * 60 * 1000;
    const now = Date.now();
    for (const [ip, data] of rateLimitStore.entries()) {
        data.requests = data.requests.filter(time => now - time < hour);
        if (data.requests.length === 0) {
            rateLimitStore.delete(ip);
        }
    }
}, 5 * 60 * 1000); // Clean every 5 minutes

// ============================================================

// MIME types for static file serving
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.vrm': 'application/octet-stream',
    '.glb': 'application/octet-stream',
    '.gltf': 'model/gltf+json'
};

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
};

// Parse JSON body from request
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

// Make request to Anthropic API
function callAnthropicAPI(apiKey, systemPrompt, messages) {
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages
        });

        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject(new Error(response.error?.message || 'API error'));
                    } else {
                        resolve(response);
                    }
                } catch (e) {
                    reject(new Error('Invalid API response'));
                }
            });
        });

        req.on('error', reject);
        req.write(requestBody);
        req.end();
    });
}

// Serve static files
function serveStaticFile(res, filePath) {
    const fullPath = join(__dirname, filePath);

    if (!existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
        res.end('File not found');
        return;
    }

    const ext = extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        const content = readFileSync(fullPath);
        res.writeHead(200, { 'Content-Type': contentType, ...CORS_HEADERS });
        res.end(content);
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
        res.end('Server error');
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
    }

    // API endpoint for chat
    if (url.pathname === '/api/chat' && req.method === 'POST') {
        try {
            // Get client IP for rate limiting
            const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
                           req.socket.remoteAddress || 'unknown';

            // Check rate limit
            const rateCheck = checkRateLimit(clientIP);
            if (!rateCheck.allowed) {
                res.writeHead(429, { 'Content-Type': 'application/json', ...CORS_HEADERS });
                res.end(JSON.stringify({ error: rateCheck.reason }));
                return;
            }

            const body = await parseBody(req);
            const { systemPrompt, messages } = body;

            // Use server's API key (ignore client-provided key for security)
            if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
                res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
                res.end(JSON.stringify({ error: 'Server API key not configured. Edit server.js to add your key.' }));
                return;
            }

            const response = await callAnthropicAPI(API_KEY, systemPrompt, messages);

            res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
            res.end(JSON.stringify(response));

        } catch (error) {
            console.error('API Error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Serve static files
    let filePath = url.pathname;
    if (filePath === '/') {
        filePath = '/index.html';
    }

    serveStaticFile(res, filePath);
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🌸 Degen Waifu Server Running! 🌸                   ║
║                                                       ║
║   Local:    http://localhost:${PORT}                    ║
║                                                       ║
║   Ready to serve your anime AI waifu~                 ║
║   wagmi 💜                                            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Try a different port.`);
    } else {
        console.error('Server error:', error);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down... bye bye~');
    server.close(() => {
        process.exit(0);
    });
});
