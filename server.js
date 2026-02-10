const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const https = require('https');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_PATH = path.join(ROOT_DIR, 'data', 'tasks.json');
const CATEGORIES_PATH = path.join(ROOT_DIR, 'data', 'categories.json');
const HISTORY_PATH = path.join(ROOT_DIR, 'data', 'history.json');
const DEFAULT_CATEGORIES = [
    'Kleine Taak',
    'Gewoonte',
    'Relatie',
    'Opruimen',
    'Focus',
    'Rust'
];

function readTasks() {
    try {
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        return [];
    }
}

function writeTasks(tasks) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(tasks, null, 2));
}

function readCategories() {
    try {
        const raw = fs.readFileSync(CATEGORIES_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [...DEFAULT_CATEGORIES];
    } catch (error) {
        return [...DEFAULT_CATEGORIES];
    }
}

function writeCategories(categories) {
    fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(categories, null, 2));
}

function readHistory() {
    try {
        const raw = fs.readFileSync(HISTORY_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries)) {
            return { entries: parsed.entries, lastResetDate: parsed.lastResetDate || null };
        }
        return { entries: [], lastResetDate: null };
    } catch (error) {
        return { entries: [], lastResetDate: null };
    }
}

function writeHistory(history) {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8'
    };

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/tasks') {
        if (req.method === 'GET') {
            return sendJson(res, 200, readTasks());
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
                if (body.length > 1_000_000) {
                    req.socket.destroy();
                }
            });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body || '[]');
                    if (!Array.isArray(parsed)) {
                        return sendJson(res, 400, { error: 'Expected an array of tasks.' });
                    }
                    writeTasks(parsed);
                    return sendJson(res, 200, { ok: true });
                } catch (error) {
                    return sendJson(res, 400, { error: 'Invalid JSON.' });
                }
            });
            return;
        }

        return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    if (url.pathname === '/api/categories') {
        if (req.method === 'GET') {
            return sendJson(res, 200, readCategories());
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
                if (body.length > 100_000) {
                    req.socket.destroy();
                }
            });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body || '[]');
                    if (!Array.isArray(parsed)) {
                        return sendJson(res, 400, { error: 'Expected an array of categories.' });
                    }
                    writeCategories(parsed);
                    return sendJson(res, 200, { ok: true });
                } catch (error) {
                    return sendJson(res, 400, { error: 'Invalid JSON.' });
                }
            });
            return;
        }

        return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    if (url.pathname === '/api/history') {
        if (req.method === 'GET') {
            return sendJson(res, 200, readHistory());
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
                if (body.length > 200_000) {
                    req.socket.destroy();
                }
            });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body || '{}');
                    if (!parsed || !Array.isArray(parsed.entries)) {
                        return sendJson(res, 400, { error: 'Expected history payload.' });
                    }
                    writeHistory({
                        entries: parsed.entries,
                        lastResetDate: parsed.lastResetDate || null
                    });
                    return sendJson(res, 200, { ok: true });
                } catch (error) {
                    return sendJson(res, 400, { error: 'Invalid JSON.' });
                }
            });
            return;
        }

        return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    if (url.pathname === '/api/quote') {
        if (req.method !== 'GET') {
            return sendJson(res, 405, { error: 'Method not allowed.' });
        }
        https.get('https://zenquotes.io/api/today', quoteRes => {
            let data = '';
            quoteRes.on('data', chunk => (data += chunk));
            quoteRes.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    return sendJson(res, 200, parsed);
                } catch (error) {
                    return sendJson(res, 500, { error: 'Invalid quote response.' });
                }
            });
        }).on('error', () => {
            return sendJson(res, 500, { error: 'Quote fetch failed.' });
        });
        return;
    }

    if (url.pathname === '/api/quote/random') {
        if (req.method !== 'GET') {
            return sendJson(res, 405, { error: 'Method not allowed.' });
        }
        https.get('https://zenquotes.io/api/random', quoteRes => {
            let data = '';
            quoteRes.on('data', chunk => (data += chunk));
            quoteRes.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    return sendJson(res, 200, parsed);
                } catch (error) {
                    return sendJson(res, 500, { error: 'Invalid quote response.' });
                }
            });
        }).on('error', () => {
            return sendJson(res, 500, { error: 'Quote fetch failed.' });
        });
        return;
    }

    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method not allowed');
        return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const safePath = path.normalize(pathname).replace(/^\.\.(\/|\\)/, '');
    const filePath = path.join(ROOT_DIR, safePath);

    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    return sendFile(res, filePath);
});

server.listen(PORT, () => {
    console.log(`Planner server running at http://localhost:${PORT}`);
});
