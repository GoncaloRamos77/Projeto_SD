const amqp = require('amqplib');
const express = require('express');
const cors = require('cors');
// Forçar rebuild da imagem
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const PORT = process.env.PORT || 3001;
const QUEUE_NAME = 'race_events';

const app = express();
app.use(cors());
app.use(express.json());

const raceData = new Map();

async function startConsumer() {
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    
    console.log(`Connected to RabbitMQ. Consuming from queue '${QUEUE_NAME}'`);
    
    channel.consume(QUEUE_NAME, (msg) => {
      if (msg) {
        try {
          const participant = JSON.parse(msg.content.toString());
          
          if (!raceData.has(participant.raceId)) {
            raceData.set(participant.raceId, new Map());
          }
          
          const race = raceData.get(participant.raceId);
          race.set(participant.id, participant);
          
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

app.get('/races', (req, res) => {
  const races = [];
  
  raceData.forEach((participants, raceId) => {
    const participantList = Array.from(participants.values());
    races.push({
      id: raceId,
      participants: participantList,
      totalParticipants: participantList.length
    });
  });
  
  res.json(races);
});

app.get('/races/:raceId', (req, res) => {
  const raceId = parseInt(req.params.raceId);
  
  if (!raceData.has(raceId)) {
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
  
  if (!raceData.has(raceId)) {
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

startConsumer();

app.listen(PORT, () => {
  console.log(`Consumer API listening on port ${PORT}`);
});
