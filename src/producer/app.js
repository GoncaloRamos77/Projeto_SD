const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const NUM_PARTICIPANTS = parseInt(process.env.NUM_PARTICIPANTS || '10');
const NUM_RACES = parseInt(process.env.NUM_RACES || '1');
const PUBLISH_INTERVAL = parseInt(process.env.PUBLISH_INTERVAL || '1000');

const QUEUE_NAME = 'race_events';

let connection;
let channel;

// Ponto inicial (ex: centro do Funchal)
const START_LAT = 32.6507;
const START_LON = -16.9090;

// Generate random participant data
function generateParticipant(id, raceId) {
  const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  return {
    id: `${raceId}-${id}`,
    raceId,
    name: names[id % names.length] + ` #${id}`,
    position: id + 1,
    speed: Math.random() * 50 + 50, // 50-100 km/h
    lat: START_LAT + (Math.random() - 0.5) * 0.001, 
    lon: START_LON + (Math.random() - 0.5) * 0.001,
    distance: 0,
    totalDistance: 1000, // 1000m race
    status: 'running',
    timestamp: Date.now()
  };
}

// Simulate race progress
function updateParticipant(participant) {
  if (participant.status === 'finished') return participant;

  const deltaTime = PUBLISH_INTERVAL / 1000; // Convert to seconds
  const deltaDistance = (participant.speed / 3.6) * deltaTime; // Convert km/h to m/s
  
  participant.distance += deltaDistance;
  participant.speed += (Math.random() - 0.5) * 10; // Random speed variation
  participant.speed = Math.max(30, Math.min(120, participant.speed)); // Keep speed in range
  participant.timestamp = Date.now();

  // --- Simulação de movimento no mapa ---
  // 0.00001 graus é aprox. 1.11 metros
  const movementFactor = 0.00001; 
  participant.lat += (Math.random() - 0.4) * participant.speed * movementFactor; // Mover para Norte
  participant.lon += (Math.random() - 0.5) * participant.speed * movementFactor;

  if (participant.distance >= participant.totalDistance) {
    participant.distance = participant.totalDistance;
    participant.status = 'finished';
  }

  return participant;
}

// Initialize RabbitMQ connection
async function connectRabbitMQ() {
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log(`Connected to RabbitMQ. Queue '${QUEUE_NAME}' ready.`);
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error.message);
    setTimeout(connectRabbitMQ, 5000); // Retry after 5 seconds
  }
}

// Publish race event
function publishEvent(event) {
  if (!channel) {
    console.warn('Channel not ready, skipping event');
    return;
  }

  try {
    const message = JSON.stringify(event);
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });
  } catch (error) {
    console.error('Error publishing event:', error.message);
  }
}

// Run race simulation
async function runSimulation() {
  await connectRabbitMQ();

  const races = [];
  
  // Initialize races
  for (let raceId = 0; raceId < NUM_RACES; raceId++) {
    const participants = [];
    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
      participants.push(generateParticipant(i, raceId));
    }
    races.push({ id: raceId, participants, active: true });
    console.log(`Race ${raceId} initialized with ${NUM_PARTICIPANTS} participants`);
  }

  // Simulation loop
  setInterval(() => {
    let activeRaces = 0;
    
    races.forEach(race => {
      if (!race.active) return;

      let allFinished = true;
      
      race.participants.forEach(participant => {
        updateParticipant(participant);
        publishEvent(participant);
        
        if (participant.status !== 'finished') {
          allFinished = false;
        }
      });

      // Sort by distance (descending) to update positions
      race.participants.sort((a, b) => b.distance - a.distance);
      race.participants.forEach((p, idx) => {
        p.position = idx + 1;
      });

      if (allFinished) {
        race.active = false;
        console.log(`Race ${race.id} finished!`);
        
        // Restart race after 5 seconds
        setTimeout(() => {
          race.participants = [];
          for (let i = 0; i < NUM_PARTICIPANTS; i++) {
            race.participants.push(generateParticipant(i, race.id));
          }
          race.active = true;
          console.log(`Race ${race.id} restarted`);
        }, 5000);
      } else {
        activeRaces++;
      }
    });

    if (activeRaces > 0) {
      console.log(`Active races: ${activeRaces}`);
    }
  }, PUBLISH_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (channel) await channel.close();
  if (connection) await connection.close();
  process.exit(0);
});

// Start the producer
runSimulation().catch(console.error);