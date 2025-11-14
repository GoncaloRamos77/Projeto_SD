const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const NUM_PARTICIPANTS = parseInt(process.env.NUM_PARTICIPANTS || '10');
const NUM_RACES = parseInt(process.env.NUM_RACES || '1');
const PUBLISH_INTERVAL = parseInt(process.env.PUBLISH_INTERVAL || '1000');

const QUEUE_NAME = 'race_events';

let connection;
let channel;

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

// --- Lógica da Simulação ---

function generateParticipant(id, raceId) {
  const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  const startPosition = TRACK_PATH[0];
  
  return {
    id: `${raceId}-${id}`,
    raceId,
    name: names[id % names.length] + ` #${id}`,
    position: id + 1,
    speed: Math.random() * 50 + 150, // Velocidade mais alta para uma pista (150-200 km/h)
    
    // Posição inicial
    lat: startPosition[0], 
    lon: startPosition[1],
    
    distance: 0,
    totalDistance: TRACK_TOTAL_DISTANCE * 5, // Simular 5 voltas
    status: 'running',
    timestamp: Date.now()
  };
}

function updateParticipant(participant) {
  if (participant.status === 'finished') return participant;

  const deltaTime = PUBLISH_INTERVAL / 1000; // Segundos
  const deltaDistance = (participant.speed / 3.6) * deltaTime; // m/s
  
  participant.distance += deltaDistance;
  participant.speed += (Math.random() - 0.5) * 10; 
  participant.speed = Math.max(100, Math.min(250, participant.speed)); // Limites de velocidade
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
    
    // Posição final (linha de meta)
    const finalPosition = TRACK_PATH[TRACK_PATH.length - 1];
    participant.lat = finalPosition[0];
    participant.lon = finalPosition[1];
  }

  return participant;
}

async function connectRabbitMQ() {
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log(`Connected to RabbitMQ. Queue '${QUEUE_NAME}' ready.`);
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
  try {
    const message = JSON.stringify(event);
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });
  } catch (error) {
    console.error('Error publishing event:', error.message);
  }
}

async function runSimulation() {
  await connectRabbitMQ();

  const races = [];
  
  for (let raceId = 0; raceId < NUM_RACES; raceId++) {
    const participants = [];
    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
      participants.push(generateParticipant(i, raceId));
    }
    races.push({ id: raceId, participants, active: true });
    console.log(`Race ${raceId} initialized with ${NUM_PARTICIPANTS} participants`);
  }

  // Loop de Simulação
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

      race.participants.sort((a, b) => b.distance - a.distance);
      race.participants.forEach((p, idx) => { p.position = idx + 1; });

      if (allFinished) {
        race.active = false;
        console.log(`Race ${race.id} finished!`);
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

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (channel) await channel.close();
  if (connection) await connection.close();
  process.exit(0);
});

runSimulation().catch(console.error);