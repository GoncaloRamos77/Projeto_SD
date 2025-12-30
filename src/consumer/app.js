const amqp = require('amqplib');
const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
// Forçar rebuild da imagem
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const PORT = process.env.PORT || 3001;
// Fanout exchange name shared with producer. Each consumer replica gets its own
// queue bound to this exchange to receive all messages (not load-balanced).
const EXCHANGE_NAME = process.env.RACE_EXCHANGE || 'race_events';

// Races are stored in-memory. If the producer is reconfigured (e.g. NUM_RACES reduced),
// old race IDs may linger here and still show up in the UI. To avoid that, we expire
// races that haven't received updates recently.
const RACE_TTL_MS = parseInt(process.env.RACE_TTL_MS || '15000');

const app = express();
app.use(cors());
app.use(express.json());

// Prometheus metrics setup
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const messagesConsumed = new promClient.Counter({
  name: 'race_messages_consumed_total',
  help: 'Total number of messages consumed from RabbitMQ',
  labelNames: ['race_id'],
  registers: [register]
});

const apiRequests = new promClient.Counter({
  name: 'race_api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'endpoint', 'status'],
  registers: [register]
});

const apiDuration = new promClient.Histogram({
  name: 'race_api_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'endpoint'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

const racesTracked = new promClient.Gauge({
  name: 'race_consumer_races_tracked',
  help: 'Number of races currently being tracked',
  registers: [register]
});

const raceData = new Map();
const raceLastSeen = new Map();

// Middleware to track API metrics
app.use((req, res, next) => {
  const end = apiDuration.startTimer();
  res.on('finish', () => {
    const endpoint = req.route?.path || req.path;
    apiRequests.inc({ method: req.method, endpoint, status: res.statusCode });
    end({ method: req.method, endpoint });
  });
  next();
});

async function startConsumer() {
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, 'fanout', { durable: true });
    // Create a dedicated queue per consumer instance to receive the full stream
    // instead of sharing one queue (which split the data across pods).
    const { queue } = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(queue, EXCHANGE_NAME, '');
    
    console.log(`Connected to RabbitMQ. Consuming all events from exchange '${EXCHANGE_NAME}' via queue '${queue}'`);
    
    channel.consume(queue, (msg) => {
      if (msg) {
        try {
          const participant = JSON.parse(msg.content.toString());
          
          if (!raceData.has(participant.raceId)) {
            raceData.set(participant.raceId, new Map());
          }
          
          const race = raceData.get(participant.raceId);
          race.set(participant.id, participant);
          raceLastSeen.set(participant.raceId, Date.now());
          
          messagesConsumed.inc({ race_id: participant.raceId });
          racesTracked.set(raceData.size);
          
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error.message);
          channel.nack(msg, false, false);
        }
      }
    });
    
    connection.on('error', (error) => {
      console.error('RabbitMQ connection error:', error.message);
    });
    
    connection.on('close', () => {
      console.log('RabbitMQ connection closed. Reconnecting...');
      setTimeout(startConsumer, 5000);
    });
    
  } catch (error) {
    console.error('Failed to start consumer:', error.message);
    setTimeout(startConsumer, 5000);
  }
}


app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/races', (req, res) => {
  const races = [];
  const now = Date.now();
  
  raceData.forEach((participants, raceId) => {
    const lastSeen = raceLastSeen.get(raceId) || 0;
    if (now - lastSeen > RACE_TTL_MS) return;

    const participantList = Array.from(participants.values());
    races.push({
      id: raceId,
      participants: participantList,
      totalParticipants: participantList.length
    });
  });

  // Sort for stable UI
  races.sort((a, b) => a.id - b.id);
  res.json(races);
});

app.get('/races/:raceId', (req, res) => {
  const raceId = parseInt(req.params.raceId);
  const now = Date.now();
  const lastSeen = raceLastSeen.get(raceId) || 0;

  if (!raceData.has(raceId) || (now - lastSeen > RACE_TTL_MS)) {
    return res.status(404).json({ error: 'Race not found' });
  }
  
  const participants = Array.from(raceData.get(raceId).values());
  res.json({
    id: raceId,
    participants,
    totalParticipants: participants.length
  });
});

app.get('/races/:raceId/leaderboard', (req, res) => {
  const raceId = parseInt(req.params.raceId);
  const now = Date.now();
  const lastSeen = raceLastSeen.get(raceId) || 0;

  if (!raceData.has(raceId) || (now - lastSeen > RACE_TTL_MS)) {
    return res.status(404).json({ error: 'Race not found' });
  }
  
  const participants = Array.from(raceData.get(raceId).values())
    .sort((a, b) => a.position - b.position);
  
  res.json({
    raceId,
    leaderboard: participants.map(p => ({
      position: p.position,
      name: p.name,
      distance: p.distance.toFixed(2),
      speed: p.speed.toFixed(2),
      status: p.status,
      progress: ((p.distance / p.totalDistance) * 100).toFixed(1),
      lat: p.lat,
      lon: p.lon
    }))
  });
});

// Periodic cleanup to prevent unbounded memory growth and stale races in UI
setInterval(() => {
  const now = Date.now();
  for (const [raceId, lastSeen] of raceLastSeen.entries()) {
    if (now - lastSeen > RACE_TTL_MS) {
      raceLastSeen.delete(raceId);
      raceData.delete(raceId);
    }
  }
}, Math.min(5000, Math.max(1000, Math.floor(RACE_TTL_MS / 3))));

startConsumer();

app.listen(PORT, () => {
  console.log(`Consumer API listening on port ${PORT}`);
});
