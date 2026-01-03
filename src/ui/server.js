// CI/CD Auto-Deployment Working!
const express = require('express');
const path = require('path');
const promClient = require('prom-client');

const PORT = process.env.PORT || 3000;
const CONSUMER_API_URL = process.env.CONSUMER_API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.RACE_API_TOKEN;

const app = express();
//teste
// Prometheus metrics setup
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequests = new promClient.Counter({
  name: 'race_ui_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

const proxyLatency = new promClient.Histogram({
  name: 'race_ui_proxy_latency_seconds',
  help: 'Latency of proxying requests to consumer API',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register]
});

const requestDuration = new promClient.Histogram({
  name: 'race_ui_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

// Middleware to track metrics
app.use((req, res, next) => {
  const end = requestDuration.startTimer();
  res.on('finish', () => {
    const path = req.path.startsWith('/api') ? '/api/*' : req.path === '/' ? '/' : '/static';
    httpRequests.inc({ method: req.method, path, status: res.statusCode });
    end({ method: req.method, path });
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/*', async (req, res) => {
  const apiPath = req.path.replace('/api', '');
  const url = `${CONSUMER_API_URL}${apiPath}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;

  const end = proxyLatency.startTimer();
  try {
    const fetch = (await import('node-fetch')).default;
    const headers = API_TOKEN ? { 'x-race-token': API_TOKEN } : {};
    // forward method and headers (GET is enough for current use, but safe to include)
    const response = await fetch(url, { method: req.method, headers });

    const bodyText = await response.text();
    end();

    // Forward status and either parsed JSON or raw text
    res.status(response.status);
    if (!bodyText) {
      return res.send(); // empty body
    }
    try {
      const parsed = JSON.parse(bodyText);
      return res.json(parsed);
    } catch (err) {
      // Not JSON -> return raw text (helps debug HTML error pages)
      return res.send(bodyText);
    }
  } catch (error) {
    console.error('API proxy error:', error.message);
    end();
    res.status(502).json({ error: 'Failed to fetch data from consumer API' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UI server listening on port ${PORT}`);
  console.log(`Consumer API: ${CONSUMER_API_URL}`);
});
