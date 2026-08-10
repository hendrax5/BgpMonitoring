// Lightweight zero-dependency reverse proxy.
// The Kubernetes ingress routes every /api/* request to port 8001.
// This Next.js app serves its API routes on port 3000, so we forward
// all traffic received on 8001 to the Next.js server on 3000.
const http = require('http');

const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 3000;
const LISTEN_PORT = 8001;

const server = http.createServer((req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad gateway (proxy → Next.js)', detail: err.message }));
  });

  req.pipe(proxyReq, { end: true });
});

server.on('upgrade', (req, socket, head) => {
  const net = require('net');
  const proxySocket = net.connect(TARGET_PORT, TARGET_HOST, () => {
    proxySocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    proxySocket.write(head);
    socket.pipe(proxySocket);
    proxySocket.pipe(socket);
  });
  proxySocket.on('error', () => socket.destroy());
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[api-proxy] Listening on ${LISTEN_PORT} → forwarding to ${TARGET_HOST}:${TARGET_PORT}`);
});
