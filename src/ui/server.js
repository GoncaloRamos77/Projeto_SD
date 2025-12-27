// CI/CD Auto-Deployment Working!
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CONSUMER_API_URL = process.env.CONSUMER_API_URL || 'http://localhost:3001';

const app = express();

// --- Prometheus metrics ---
const client = require('prom-client');
client.collectDefaultMetrics();
const uiHttpRequests = new client.Counter({ name: 'ui_http_requests_total', help: 'Count of HTTP requests to UI' });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// middleware to count requests
app.use((req, res, next) => {
  uiHttpRequests.inc();
  next();
});

app.get('/api/*', async (req, res) => {
  const apiPath = req.path.replace('/api', '');
  const url = `${CONSUMER_API_URL}${apiPath}`;
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('API proxy error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from consumer API' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UI server listening on port ${PORT}`);
  console.log(`Consumer API: ${CONSUMER_API_URL}`);
});
