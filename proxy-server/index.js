const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

const server = http.createServer((req, res) => {
  // CORS headers - allow everything
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const targetUrl = parsed.query.url;

  if (!targetUrl) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
    return;
  }

  console.log(`[Proxy] Fetching: ${targetUrl}`);

  const target = url.parse(targetUrl);
  const lib = target.protocol === 'https:' ? https : http;

  const options = {
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.path,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, */*',
    },
    timeout: 20000,
  };

  const proxyReq = lib.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.writeHead(504);
    res.end(JSON.stringify({ error: 'Gateway Timeout' }));
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy] Error: ${err.message}`);
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  });

  proxyReq.end();
});

server.listen(PORT, () => {
  console.log(`[PixelFlix Proxy] Running at http://127.0.0.1:${PORT}`);
  console.log(`[PixelFlix Proxy] Usage: http://127.0.0.1:${PORT}/?url=<target_url>`);
});
