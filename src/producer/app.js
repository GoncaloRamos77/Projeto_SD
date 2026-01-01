const amqp = require('amqplib');
const express = require('express');
const promClient = require('prom-client');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const NUM_PARTICIPANTS = parseInt(process.env.NUM_PARTICIPANTS || '10');
const NUM_RACES = parseInt(process.env.NUM_RACES || '1');
const PUBLISH_INTERVAL = parseInt(process.env.PUBLISH_INTERVAL || '1000');
const MIN_PARTICIPANTS = parseInt(process.env.MIN_PARTICIPANTS || NUM_PARTICIPANTS);
const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || NUM_PARTICIPANTS);
const VARIABLE_PARTICIPANTS = process.env.VARIABLE_PARTICIPANTS === 'true';
const HEALTH_PORT = parseInt(process.env.PORT || '3002');
const PRODUCER_ID = process.env.PRODUCER_ID || process.env.HOSTNAME || `producer-${process.pid}`;
const PRODUCER_SHARD_SOURCE = process.env.PRODUCER_SHARD || PRODUCER_ID;

// Use a fanout exchange so every consumer replica receives a full copy of the
// stream. With a single queue and multiple consumers, RabbitMQ load-balances
// messages, which made each consumer hold only a fraction of the race state
// and the UI became inconsistent when scaled out. A fanout exchange guarantees
// broadcast semantics while keeping consumers stateless.
const EXCHANGE_NAME = process.env.RACE_EXCHANGE || 'race_events';

let connection;
let channel;

// Prometheus metrics setup
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const eventsPublished = new promClient.Counter({
  name: 'race_events_published_total',
  help: 'Total number of race events published to RabbitMQ',
  labelNames: ['race_id'],
  registers: [register]
});

const activeRacesGauge = new promClient.Gauge({
  name: 'race_active_races',
  help: 'Number of currently active races',
  registers: [register]
});

const activeParticipantsGauge = new promClient.Gauge({
  name: 'race_active_participants',
  help: 'Number of currently active participants across all races',
  registers: [register]
});

const publishLatency = new promClient.Histogram({
  name: 'race_publish_latency_seconds',
  help: 'Latency of publishing events to RabbitMQ',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register]
});

function hashStringToInt(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

const SHARD_ID = hashStringToInt(PRODUCER_SHARD_SOURCE);
const explicitRaceOffset = process.env.RACE_ID_OFFSET !== undefined
  ? parseInt(process.env.RACE_ID_OFFSET, 10)
  : undefined;
const RACE_ID_OFFSET = Number.isFinite(explicitRaceOffset)
  ? explicitRaceOffset
  : (SHARD_ID % 10000) * 1000;

// Simple HTTP health endpoint for Kubernetes probes
const app = express();
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(HEALTH_PORT, () => {
  console.log(`Producer health endpoint listening on port ${HEALTH_PORT}`);
  console.log(`Prometheus metrics available at http://localhost:${HEALTH_PORT}/metrics`);
});

// --- DADOS DO AUTÓDROMO DO ESTORIL ---

// Comprimento oficial da pista em metros
const TRACK_TOTAL_DISTANCE = 4183; // 4182.72m

// Um array simplificado de coordenadas [lat, lon] que define o percurso da pista.
// Para mais precisão, este array devia ter centenas de pontos de um ficheiro GPX.
const TRACK_PATH = [
    [38.75051, -9.39420], // Reta da meta (Início)
    [38.75231, -9.39515], // Curva 1 (VIP)
    [38.75294, -9.39291], // Curva 2
    [38.75083, -9.39133], // Curva 3 (Parabólica Interior)
    [38.74834, -9.39223], // Curva 4
    [38.74751, -9.39542], // Curva 5
    [38.74780, -9.39702], // Curva 6
    [38.74902, -9.39805], // Curva 7 (Variante)
    [38.75084, -9.39920], // Curva 8
    [38.75195, -9.40050], // Curva 9 (Gancho)
    [38.74983, -9.40050], // Curva 10
    [38.74872, -9.39755], // Curva 11
    [38.74992, -9.39520], // Curva 12
    [38.75021, -9.39462], // Curva 13 (Parabólica Ayrton Senna)
    [38.75051, -9.39420]  // Reta da meta (Fim)
];

// --- Funções Auxiliares de Cálculo ---

/**
 * Calcula a distância Haversine entre dois pontos [lat, lon] em metros.
 */
function haversineDistance(coords1, coords2) {
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Pré-calcular os comprimentos de cada segmento da pista
const TRACK_SEGMENT_LENGTHS = [];
let TRACK_TOTAL_LENGTH_CALCULATED = 0;
for (let i = 0; i < TRACK_PATH.length - 1; i++) {
    const dist = haversineDistance(TRACK_PATH[i], TRACK_PATH[i + 1]);
    TRACK_SEGMENT_LENGTHS.push(dist);
    TRACK_TOTAL_LENGTH_CALCULATED += dist;
}

/**
 * Calcula a posição [lat, lon] exata na pista para uma determinada distância.
 */
function calculatePositionOnTrack(distance) {
    // Normalizar a distância para o comprimento da pista (para o caso de várias voltas)
    let distanceAlongPath = distance % TRACK_TOTAL_LENGTH_CALCULATED;
    
    if (distanceAlongPath < 0) distanceAlongPath += TRACK_TOTAL_LENGTH_CALCULATED;

    for (let i = 0; i < TRACK_SEGMENT_LENGTHS.length; i++) {
        if (distanceAlongPath <= TRACK_SEGMENT_LENGTHS[i]) {
            // O participante está neste segmento
            const segmentStart = TRACK_PATH[i];
            const segmentEnd = TRACK_PATH[i + 1];
            const segmentRatio = distanceAlongPath / TRACK_SEGMENT_LENGTHS[i];

            // Interpolação linear entre os dois pontos
            const lat = segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * segmentRatio;
            const lon = segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * segmentRatio;
            return { lat, lon };
        }
        // Subtrai o comprimento do segmento e passa ao próximo
        distanceAlongPath -= TRACK_SEGMENT_LENGTHS[i];
    }

    // Se algo falhar (ex: problemas de arredondamento), retorna o último ponto
    return { lat: TRACK_PATH[TRACK_PATH.length - 1][0], lon: TRACK_PATH[TRACK_PATH.length - 1][1] };
}

// --- Perfis de Participantes ---
const PARTICIPANT_PROFILES = [
  { type: 'professional', baseSpeed: 200, speedVariation: 20, skill: 0.9 },
  { type: 'experienced', baseSpeed: 180, speedVariation: 25, skill: 0.75 },
  { type: 'intermediate', baseSpeed: 160, speedVariation: 30, skill: 0.6 },
  { type: 'amateur', baseSpeed: 140, speedVariation: 35, skill: 0.4 }
];

const PARTICIPANT_NAMES = [
  'Hamilton', 'Verstappen', 'Leclerc', 'Sainz', 'Russell', 'Norris', 'Piastri', 'Alonso',
  'Perez', 'Gasly', 'Ocon', 'Stroll', 'Bottas', 'Zhou', 'Hulkenberg', 'Magnussen',
  'Tsunoda', 'Ricciardo', 'Albon', 'Sargeant', 'Lawson', 'Colapinto', 'Bearman', 'Antonelli'
];

// --- Lógica da Simulação ---

function generateParticipant(id, raceId) {
  const startPosition = TRACK_PATH[0];
  
  // Selecionar perfil aleatório
  const profile = PARTICIPANT_PROFILES[Math.floor(Math.random() * PARTICIPANT_PROFILES.length)];
  const name = PARTICIPANT_NAMES[id % PARTICIPANT_NAMES.length];
  
  // Variação na velocidade base
  const initialSpeed = profile.baseSpeed + (Math.random() - 0.5) * profile.speedVariation;
  
  return {
    id: `race-${raceId}-p-${id}`,
    raceId,
    producerId: PRODUCER_ID,
    name: `${name} #${id}`,
    profile: profile.type,
    skill: profile.skill,
    position: id + 1,
    speed: initialSpeed,
    baseSpeed: profile.baseSpeed,
    speedVariation: profile.speedVariation,
    
    // Posição inicial
    lat: startPosition[0], 
    lon: startPosition[1],
    
    distance: 0,
    lap: 1,
    totalLaps: 5, // 5 voltas
    totalDistance: TRACK_TOTAL_DISTANCE * 5,
    status: 'running',
    timestamp: Date.now()
  };
}

function updateParticipant(participant) {
  if (participant.status === 'finished') return participant;

  const deltaTime = PUBLISH_INTERVAL / 1000; // Segundos
  const deltaDistance = (participant.speed / 3.6) * deltaTime; // m/s
  
  const previousDistance = participant.distance;
  participant.distance += deltaDistance;
  
  // Atualizar volta
  participant.lap = Math.floor(participant.distance / TRACK_TOTAL_DISTANCE) + 1;
  
  // Variação de velocidade baseada no perfil e habilidade
  const speedChange = (Math.random() - 0.5) * participant.speedVariation * (1 - participant.skill);
  participant.speed += speedChange;
  
  // Limites de velocidade baseados no perfil
  const minSpeed = participant.baseSpeed - participant.speedVariation * 2;
  const maxSpeed = participant.baseSpeed + participant.speedVariation;
  participant.speed = Math.max(minSpeed, Math.min(maxSpeed, participant.speed));
  
  participant.timestamp = Date.now();

  // --- NOVA LÓGICA DE MOVIMENTO ---
  // Calcula a posição exata na pista com base na distância
  const newPosition = calculatePositionOnTrack(participant.distance);
  participant.lat = newPosition.lat;
  participant.lon = newPosition.lon;
  // --- FIM DA NOVA LÓGICA ---

  if (participant.distance >= participant.totalDistance) {
    participant.distance = participant.totalDistance;
    participant.status = 'finished';
    participant.lap = participant.totalLaps;
    
    // Posição final (linha de meta)
    const finalPosition = TRACK_PATH[TRACK_PATH.length - 1];
    participant.lat = finalPosition[0];
    participant.lon = finalPosition[1];
  }

  participant.producerId = PRODUCER_ID;
  return participant;
}

async function connectRabbitMQ() {
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, 'fanout', { durable: true });
    console.log(`Connected to RabbitMQ. Exchange '${EXCHANGE_NAME}' ready.`);
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error.message);
    setTimeout(connectRabbitMQ, 5000); // Tentar novamente
  }
}

function publishEvent(event) {
  if (!channel) {
    console.warn('Channel not ready, skipping event');
    return;
  }
  const end = publishLatency.startTimer();
  try {
    const message = JSON.stringify(event);
    channel.publish(EXCHANGE_NAME, '', Buffer.from(message), { persistent: true });
    eventsPublished.inc({ race_id: event.raceId });
    end();
  } catch (error) {
    console.error('Error publishing event:', error.message);
    end();
  }
}

function getRandomParticipantCount() {
  if (VARIABLE_PARTICIPANTS) {
    return Math.floor(Math.random() * (MAX_PARTICIPANTS - MIN_PARTICIPANTS + 1)) + MIN_PARTICIPANTS;
  }
  return NUM_PARTICIPANTS;
}

function initializeRace(raceId) {
  const numParticipants = getRandomParticipantCount();
  const participants = [];
  
  for (let i = 0; i < numParticipants; i++) {
    participants.push(generateParticipant(i, raceId));
  }
  
  console.log(`[Race ${raceId}] Initialized with ${numParticipants} participants`);
  return { id: raceId, participants, active: true, numParticipants };
}

async function runSimulation() {
  await connectRabbitMQ();

  const races = [];
  
  console.log('\n=== SIMULATION CONFIGURATION ===');
  console.log(`Number of races: ${NUM_RACES}`);
  console.log(`Participants per race: ${VARIABLE_PARTICIPANTS ? `${MIN_PARTICIPANTS}-${MAX_PARTICIPANTS} (variable)` : NUM_PARTICIPANTS}`);
  console.log(`Publish interval: ${PUBLISH_INTERVAL}ms`);
  console.log(`Track: Autódromo do Estoril (${TRACK_TOTAL_DISTANCE}m)`);
  console.log(`Producer shard source: ${PRODUCER_SHARD_SOURCE}`);
  console.log(`Computed shard ID: ${SHARD_ID}`);
  console.log(`Race ID offset: ${RACE_ID_OFFSET}`);
  console.log('================================\n');
  
  for (let raceIndex = 0; raceIndex < NUM_RACES; raceIndex++) {
    races.push(initializeRace(RACE_ID_OFFSET + raceIndex));
  }

  // Loop de Simulação
  let iterationCount = 0;
  setInterval(() => {
    iterationCount++;
    let activeRaces = 0;
    let totalActiveParticipants = 0;
    
    races.forEach(race => {
      if (!race.active) return;
      
      let allFinished = true;
      let activeParticipantsInRace = 0;
      
      race.participants.forEach(participant => {
        updateParticipant(participant);
        publishEvent(participant);
        
        if (participant.status !== 'finished') {
          allFinished = false;
          activeParticipantsInRace++;
        }
      });

      // Atualizar posições baseadas na distância percorrida
      race.participants.sort((a, b) => b.distance - a.distance);
      race.participants.forEach((p, idx) => { p.position = idx + 1; });

      if (allFinished) {
        race.active = false;
        const winner = race.participants[0];
        console.log(`\n[Race ${race.id}] FINISHED! Winner: ${winner.name} (Profile: ${winner.profile})`);
        console.log(`[Race ${race.id}] Top 3: 1st ${race.participants[0].name}, 2nd ${race.participants[1]?.name || 'N/A'}, 3rd ${race.participants[2]?.name || 'N/A'}\n`);
        
        // Reiniciar corrida após 5 segundos
        setTimeout(() => {
          const newRace = initializeRace(race.id);
          race.participants = newRace.participants;
          race.numParticipants = newRace.numParticipants;
          race.active = true;
          console.log(`[Race ${race.id}] Restarted\n`);
        }, 5000);
      } else {
        activeRaces++;
        totalActiveParticipants += activeParticipantsInRace;
      }
    });
    
    // Update Prometheus gauges
    activeRacesGauge.set(activeRaces);
    activeParticipantsGauge.set(totalActiveParticipants);
    
    // Log de progresso a cada 10 iterações
    if (iterationCount % 10 === 0 && activeRaces > 0) {
      console.log(`[Iteration ${iterationCount}] Active races: ${activeRaces}, Total participants racing: ${totalActiveParticipants}`);
    }
  }, PUBLISH_INTERVAL);
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (channel) await channel.close();
  if (connection) await connection.close();
  process.exit(0);
});

runSimulation().catch(console.error);
