const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const clients = new Set();

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'system', text: 'Terhubung ke server realtime.' })}\n\n`);
    clients.add(res);
    broadcast({ type: 'system', text: `Pengguna online: ${clients.size}` });
    req.on('close', () => {
      clients.delete(res);
      broadcast({ type: 'system', text: `Pengguna online: ${clients.size}` });
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/send') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body || '{}');
        const name = String(msg.name || 'Anon').slice(0, 30);
        const text = String(msg.text || '').trim().slice(0, 500);
        if (!text) return send(res, 400, 'Pesan kosong');
        broadcast({ type: 'chat', name, text, time: new Date().toLocaleTimeString() });
        send(res, 200, 'ok');
      } catch {
        send(res, 400, 'JSON tidak valid');
      }
    });
    return;
  }

  send(res, 404, 'Not found');
});

server.listen(PORT, () => {
  console.log(`Realtime web berjalan di http://localhost:${PORT}`);
});
