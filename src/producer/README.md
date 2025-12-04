# Race Producer Service - Fase 2

Serviço produtor que simula corridas em tempo real com número variável de participantes.

## Funcionalidades Implementadas (Fase 2)

### ✅ Número Variável de Participantes
- Suporte para múltiplas corridas simultâneas
- Cada corrida pode ter um número diferente de participantes
- Configurável via variáveis de ambiente

### ✅ Perfis de Participantes
Quatro tipos de perfis com características diferentes:

1. **Professional** 
   - Velocidade base: 200 km/h
   - Variação: ±20 km/h
   - Habilidade: 90%

2. **Experienced**
   - Velocidade base: 180 km/h
   - Variação: ±25 km/h
   - Habilidade: 75%

3. **Intermediate**
   - Velocidade base: 160 km/h
   - Variação: ±30 km/h
   - Habilidade: 60%

4. **Amateur**
   - Velocidade base: 140 km/h
   - Variação: ±35 km/h
   - Habilidade: 40%

### ✅ Simulação Realista
- Movimento preciso ao longo do circuito do Autódromo do Estoril
- Variação de velocidade baseada no perfil e habilidade do participante
- Sistema de voltas (5 voltas por corrida)
- Reinício automático das corridas após conclusão

## Variáveis de Ambiente

### Obrigatórias
```bash
RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672"
```

### Configuração de Corridas
```bash
# Número de corridas simultâneas
NUM_RACES="3"                    # Padrão: 1

# Número fixo de participantes (se VARIABLE_PARTICIPANTS=false)
NUM_PARTICIPANTS="10"            # Padrão: 10

# Intervalo de publicação em milissegundos
PUBLISH_INTERVAL="1000"          # Padrão: 1000ms (1 segundo)
```

### Configuração de Participantes Variáveis (NOVO)
```bash
# Ativar número variável de participantes
VARIABLE_PARTICIPANTS="true"     # Padrão: false

# Número mínimo de participantes por corrida
MIN_PARTICIPANTS="5"             # Padrão: NUM_PARTICIPANTS

# Número máximo de participantes por corrida
MAX_PARTICIPANTS="15"            # Padrão: NUM_PARTICIPANTS
```

## Exemplos de Configuração

### Exemplo 1: Corrida Única com 10 Participantes
```yaml
RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672"
NUM_RACES: "1"
NUM_PARTICIPANTS: "10"
PUBLISH_INTERVAL: "1000"
VARIABLE_PARTICIPANTS: "false"
```

### Exemplo 2: Múltiplas Corridas com Número Variável
```yaml
RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672"
NUM_RACES: "3"
PUBLISH_INTERVAL: "1000"
VARIABLE_PARTICIPANTS: "true"
MIN_PARTICIPANTS: "5"
MAX_PARTICIPANTS: "15"
```

### Exemplo 3: Simulação de Alto Volume
```yaml
RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672"
NUM_RACES: "10"
PUBLISH_INTERVAL: "500"
VARIABLE_PARTICIPANTS: "true"
MIN_PARTICIPANTS: "10"
MAX_PARTICIPANTS: "20"
```

## Formato dos Eventos Publicados

```json
{
  "id": "race-0-p-5",
  "raceId": 0,
  "name": "Hamilton #5",
  "profile": "professional",
  "skill": 0.9,
  "position": 2,
  "speed": 205.3,
  "baseSpeed": 200,
  "speedVariation": 20,
  "lat": 38.75051,
  "lon": -9.39420,
  "distance": 8366,
  "lap": 2,
  "totalLaps": 5,
  "totalDistance": 20915,
  "status": "running",
  "timestamp": 1701696123456
}
```

## Logs de Simulação

O serviço produz logs detalhados:

```
=== SIMULATION CONFIGURATION ===
Number of races: 3
Participants per race: 5-15 (variable)
Publish interval: 1000ms
Track: Autódromo do Estoril (4183m)
================================

[Race 0] Initialized with 12 participants
[Race 1] Initialized with 8 participants
[Race 2] Initialized with 14 participants

[Iteration 10] Active races: 3, Total participants racing: 34

[Race 1] FINISHED! Winner: Verstappen #2 (Profile: professional)
[Race 1] Top 3: 1st Verstappen #2, 2nd Hamilton #0, 3rd Leclerc #1

[Race 1] Restarted
```

## Execução Local

### Com Docker
```bash
docker build -t race-producer .
docker run -e RABBITMQ_URL="amqp://guest:guest@localhost:5672" \
           -e NUM_RACES="3" \
           -e VARIABLE_PARTICIPANTS="true" \
           -e MIN_PARTICIPANTS="5" \
           -e MAX_PARTICIPANTS="15" \
           race-producer
```

### Com Node.js
```bash
npm install
export RABBITMQ_URL="amqp://guest:guest@localhost:5672"
export NUM_RACES="3"
export VARIABLE_PARTICIPANTS="true"
export MIN_PARTICIPANTS="5"
export MAX_PARTICIPANTS="15"
npm start
```

## Deploy no Kubernetes

As configurações podem ser ajustadas no ConfigMap:

```bash
kubectl apply -f k8s/producer/configmap.yaml
kubectl apply -f k8s/producer/deployment.yaml
```

Para atualizar as configurações:
```bash
kubectl edit configmap producer-config
kubectl rollout restart deployment producer
```

## Testes e Validação

Verificar os logs do producer:
```bash
kubectl logs -f deployment/producer
```

Verificar mensagens no RabbitMQ:
```bash
# Aceder à interface web do RabbitMQ
http://localhost:30672

# Ou verificar via CLI
kubectl exec -it deployment/rabbitmq -- rabbitmqctl list_queues
```

## Requisitos da Fase 2 Implementados

- ✅ Simular uma ou várias corridas com número variável de participantes
- ✅ Perfis configuráveis de participantes (velocidade, habilidade)
- ✅ Número de participantes facilmente configurável
- ✅ Número de corridas simultâneas configurável
- ✅ Publicação de eventos em intervalos configuráveis
- ✅ Simulação de movimento ao longo do percurso real do Autódromo do Estoril
