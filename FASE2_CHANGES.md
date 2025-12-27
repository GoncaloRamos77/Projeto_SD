# Fase 2 - Implementação de Corridas com Número Variável de Participantes

## Resumo das Mudanças

Este documento descreve as implementações realizadas para cumprir o requisito da **Fase 2**: *"Simular uma ou várias corridas com número variável de participantes"*.

## Arquivos Modificados

### 1. `src/producer/app.js`
**Mudanças principais:**

#### a) Novas Variáveis de Ambiente
```javascript
const MIN_PARTICIPANTS = parseInt(process.env.MIN_PARTICIPANTS || NUM_PARTICIPANTS);
const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || NUM_PARTICIPANTS);
const VARIABLE_PARTICIPANTS = process.env.VARIABLE_PARTICIPANTS === 'true';
```

#### b) Sistema de Perfis de Participantes
Adicionados 4 perfis diferentes com características distintas:
- **Professional**: 200 km/h base, habilidade 90%
- **Experienced**: 180 km/h base, habilidade 75%
- **Intermediate**: 160 km/h base, habilidade 60%
- **Amateur**: 140 km/h base, habilidade 40%

```javascript
const PARTICIPANT_PROFILES = [
  { type: 'professional', baseSpeed: 200, speedVariation: 20, skill: 0.9 },
  { type: 'experienced', baseSpeed: 180, speedVariation: 25, skill: 0.75 },
  { type: 'intermediate', baseSpeed: 160, speedVariation: 30, skill: 0.6 },
  { type: 'amateur', baseSpeed: 140, speedVariation: 35, skill: 0.4 }
];
```

#### c) Nomes Realistas de Participantes
Lista expandida com 24 nomes de pilotos conhecidos:
```javascript
const PARTICIPANT_NAMES = [
  'Hamilton', 'Verstappen', 'Leclerc', 'Sainz', 'Russell', 'Norris', ...
];
```

#### d) Função `generateParticipant()` Melhorada
- Seleção aleatória de perfil para cada participante
- Atribuição de características baseadas no perfil
- IDs únicos no formato `race-{raceId}-p-{participantId}`
- Campos adicionais: `profile`, `skill`, `lap`, `totalLaps`

#### e) Função `updateParticipant()` Melhorada
- Cálculo de voltas baseado na distância percorrida
- Variação de velocidade influenciada pelo perfil e habilidade
- Limites de velocidade dinâmicos baseados no perfil

#### f) Número Variável de Participantes
Nova função `getRandomParticipantCount()`:
```javascript
function getRandomParticipantCount() {
  if (VARIABLE_PARTICIPANTS) {
    return Math.floor(Math.random() * (MAX_PARTICIPANTS - MIN_PARTICIPANTS + 1)) + MIN_PARTICIPANTS;
  }
  return NUM_PARTICIPANTS;
}
```

#### g) Melhorias no Sistema de Logs
- Banner de configuração no início da simulação
- Logs detalhados de início e reinício de corridas
- Informação do vencedor e top 3 ao fim de cada corrida
- Progress tracking a cada 10 iterações

### 2. `k8s/producer/configmap.yaml`
**Novas configurações adicionadas:**

```yaml
data:
  NUM_RACES: "3"                      # Alterado de 10 para 3
  VARIABLE_PARTICIPANTS: "true"       # NOVO: Ativar número variável
  MIN_PARTICIPANTS: "5"               # NOVO: Mínimo de participantes
  MAX_PARTICIPANTS: "15"              # NOVO: Máximo de participantes
```

## Arquivos Criados

### 3. `src/producer/README.md`
Documentação completa do serviço Producer incluindo:
- Funcionalidades implementadas
- Descrição dos perfis de participantes
- Todas as variáveis de ambiente disponíveis
- Exemplos de configuração
- Formato dos eventos publicados
- Instruções de execução e deploy

## Funcionalidades Implementadas

### ✅ Requisito Principal: Número Variável de Participantes
- Cada corrida pode ter um número diferente de participantes
- Configurável via `VARIABLE_PARTICIPANTS`, `MIN_PARTICIPANTS`, `MAX_PARTICIPANTS`
- Quando desativado, usa `NUM_PARTICIPANTS` fixo

### ✅ Múltiplas Corridas Simultâneas
- Suporte para N corridas simultâneas (configurável via `NUM_RACES`)
- Cada corrida é independente e pode ter configurações diferentes
- Reinício automático após conclusão

### ✅ Perfis Variados de Participantes
- 4 perfis diferentes com características únicas
- Distribuição aleatória de perfis por corrida
- Comportamento realista baseado em habilidade e perfil

### ✅ Simulação Realista
- Sistema de voltas implementado
- Tracking de posição em tempo real
- Variação de velocidade baseada em perfil
- Movimento ao longo do percurso real do Autódromo do Estoril

### ✅ Logs Detalhados
- Configuração da simulação ao início
- Informação de corridas ativas
- Resultados ao fim de cada corrida
- Progress tracking periódico

## Formato dos Eventos (Atualizado)

Os eventos agora incluem novos campos:

```json
{
  "id": "race-0-p-5",           // Novo formato de ID
  "raceId": 0,
  "name": "Hamilton #5",         // Nomes realistas
  "profile": "professional",     // NOVO: Perfil do participante
  "skill": 0.9,                  // NOVO: Habilidade
  "position": 2,
  "speed": 205.3,
  "baseSpeed": 200,              // NOVO: Velocidade base
  "speedVariation": 20,          // NOVO: Variação de velocidade
  "lat": 38.75051,
  "lon": -9.39420,
  "distance": 8366,
  "lap": 2,                      // NOVO: Volta atual
  "totalLaps": 5,                // NOVO: Total de voltas
  "totalDistance": 20915,
  "status": "running",
  "timestamp": 1701696123456
}
```

## Exemplos de Uso

### Cenário 1: Corrida Única Fixa
```yaml
NUM_RACES: "1"
NUM_PARTICIPANTS: "10"
VARIABLE_PARTICIPANTS: "false"
```

### Cenário 2: Múltiplas Corridas com Variação (IMPLEMENTADO)
```yaml
NUM_RACES: "3"
VARIABLE_PARTICIPANTS: "true"
MIN_PARTICIPANTS: "5"
MAX_PARTICIPANTS: "15"
```

### Cenário 3: Alto Volume
```yaml
NUM_RACES: "10"
PUBLISH_INTERVAL: "500"
VARIABLE_PARTICIPANTS: "true"
MIN_PARTICIPANTS: "10"
MAX_PARTICIPANTS: "20"
```

## Teste da Implementação

Para testar localmente:

```bash
# 1. Garantir que o RabbitMQ está a correr
kubectl port-forward service/rabbitmq 5672:5672

# 2. Testar localmente (se Node.js instalado)
cd src/producer
npm install
export RABBITMQ_URL="amqp://guest:guest@localhost:5672"
export NUM_RACES="3"
export VARIABLE_PARTICIPANTS="true"
export MIN_PARTICIPANTS="5"
export MAX_PARTICIPANTS="15"
npm start
```

Ou via Kubernetes:

```bash
# 1. Aplicar configurações
kubectl apply -f k8s/producer/configmap.yaml
kubectl apply -f k8s/producer/deployment.yaml

# 2. Verificar logs
kubectl logs -f deployment/producer

# 3. Verificar RabbitMQ
# Aceder a http://localhost:30672
# Ver queue 'race_events' a receber mensagens
```

## Próximos Passos

Para completar a Fase 2, ainda falta:
- [ ] Atualizar Consumer para processar novos campos
- [ ] Atualizar UI para mostrar perfis e voltas
- [ ] Implementar armazenamento de dados
- [ ] Adicionar métricas Prometheus
- [ ] Configurar Grafana dashboards
- [ ] Implementar alta disponibilidade
- [ ] Adicionar mecanismos de segurança

## Compatibilidade

✅ **Retrocompatível**: As mudanças são retrocompatíveis. Se as novas variáveis de ambiente não forem definidas, o sistema funciona como antes.

✅ **Consumer e UI**: O consumer e UI existentes continuam a funcionar, pois os campos originais foram mantidos. Os novos campos são adicionais.
