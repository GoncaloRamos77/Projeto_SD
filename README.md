# Sistema de Streaming de Dados em Tempo Real - Fase 1

Sistema distribuído com arquitetura de microsserviços para simulação e visualização de corridas em tempo real.

## 📋 Fase 1: CI/CD Automático com Aplicação Base

### Pré-requisitos

- Docker Desktop ou K3s instalado e em execução
- kubectl configurado
- Conta no DockerHub
- Repositório GitHub público

## 🚀 Configuração

### 1. Configurar GitHub Actions para DockerHub

#### a) Criar tokens no DockerHub
1. Aceder a https://hub.docker.com/settings/security
2. Criar um novo Access Token
3. Guardar o token gerado

#### b) Configurar Secrets no GitHub
1. Ir para o repositório no GitHub → Settings → Secrets and variables → Actions
2. Adicionar os seguintes secrets:
   - `DOCKERHUB_USERNAME`: o teu username do DockerHub
   - `DOCKERHUB_TOKEN`: o token criado no passo anterior

#### c) Atualizar os deployments com o teu username
Substituir `<DOCKERHUB_USERNAME>` pelo teu username do DockerHub nos ficheiros:
- `k8s/producer/deployment.yaml`
- `k8s/consumer/deployment.yaml`
- `k8s/ui/deployment.yaml`

### 2. Instalar ArgoCD no Cluster Local

```bash
# Executar script de instalação
./scripts/install-argocd.sh
```

Após a instalação, o script mostrará:
- URL de acesso (https://localhost:30443)
- Username (admin)
- Password inicial

### 3. Configurar ArgoCD Application

```bash
# Certificar que o repositório Git está configurado
git remote -v

# Executar script de configuração
./scripts/setup-argocd-app.sh
```

Este script:
- Detecta automaticamente o URL do repositório Git
- Atualiza `argocd/application.yaml` com o URL correto
- Cria a Application no ArgoCD

### 4. Deploy do Broker RabbitMQ

```bash
# Aplicar manifests do RabbitMQ
kubectl apply -f k8s/broker/
```

Verificar status:
```bash
kubectl get pods -l app=rabbitmq
kubectl get svc rabbitmq
```

Aceder à interface de gestão: http://localhost:30672
- Username: guest
- Password: guest

## 🔄 Pipeline CI/CD

### Workflow Automático

Quando fazes push para a branch `main`:
1. **GitHub Actions** constrói as imagens Docker (producer, consumer, ui)
2. Faz push das imagens para DockerHub
3. Atualiza os manifests Kubernetes com as novas versões
4. **ArgoCD** detecta as mudanças e faz deploy automático no cluster

### Testar a Pipeline

```bash
# Fazer uma alteração qualquer
echo "# teste" >> README.md

# Commit e push
git add .
git commit -m "Teste pipeline CI/CD"
git push origin main
```

Verificar:
- GitHub Actions: https://github.com/<username>/<repo>/actions
- ArgoCD: https://localhost:30443

## 📊 Verificar Deployments

```bash
# Ver todos os pods
kubectl get pods

# Ver todos os serviços
kubectl get svc

# Ver status da Application no ArgoCD
kubectl get applications -n argocd

# Ver logs de um serviço
kubectl logs -l app=producer
kubectl logs -l app=consumer
kubectl logs -l app=rabbitmq
```

## 🌐 Acessos

- **UI**: http://localhost:30000
- **Consumer API**: http://localhost:30001 (interno ao cluster)
- **RabbitMQ Management**: http://localhost:30672
- **ArgoCD**: https://localhost:30443

## 📁 Estrutura do Projeto

```
.
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # Pipeline GitHub Actions
├── argocd/
│   └── application.yaml         # Configuração ArgoCD
├── k8s/
│   ├── broker/                  # Manifests RabbitMQ
│   │   ├── configmap.yaml
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── producer/                # Manifests Producer
│   │   ├── configmap.yaml
│   │   └── deployment.yaml
│   ├── consumer/                # Manifests Consumer
│   │   ├── configmap.yaml
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ui/                      # Manifests UI
│       ├── configmap.yaml
│       ├── deployment.yaml
│       └── service.yaml
├── scripts/
│   ├── install-argocd.sh        # Instalar ArgoCD
│   └── setup-argocd-app.sh      # Configurar Application
└── src/
    ├── producer/                # Código Producer
    ├── consumer/                # Código Consumer
    └── ui/                      # Código UI
```

## 🔧 Configurações

### Producer
Configurável via `k8s/producer/configmap.yaml`:
- `NUM_PARTICIPANTS`: Número de participantes por corrida (default: 10)
- `NUM_RACES`: Número de corridas simultâneas (default: 1)
- `PUBLISH_INTERVAL`: Intervalo de publicação em ms (default: 1000)

### Consumer
Configurável via `k8s/consumer/configmap.yaml`:
- `PORT`: Porta da API REST (default: 3001)

### UI
Configurável via `k8s/ui/configmap.yaml`:
- `CONSUMER_API_URL`: URL da API do Consumer
- `PORT`: Porta da aplicação web (default: 3000)

## 🐛 Troubleshooting

### ArgoCD não sincroniza
```bash
# Forçar sincronização
kubectl patch application race-streaming-system -n argocd --type merge -p '{"operation": {"initiatedBy": {"username": "admin"}, "sync": {"revision": "main"}}}'
```

### Pods não iniciam
```bash
# Ver eventos
kubectl get events --sort-by='.lastTimestamp'

# Ver logs de um pod específico
kubectl logs <pod-name>
```

### RabbitMQ não conecta
```bash
# Verificar se o serviço está up
kubectl get svc rabbitmq

# Ver logs
kubectl logs -l app=rabbitmq
```

## 📝 Notas

- As imagens Docker devem ter Dockerfiles nos diretórios `src/*/`
- O ArgoCD usa sincronização automática (self-heal e prune ativados)
- A pipeline só é executada em pushes para a branch `main`
- Os NodePorts usados: 30000 (UI), 30443 (ArgoCD), 30672 (RabbitMQ)

## 📚 Documentação Adicional

- [Docker Hub](https://hub.docker.com/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [RabbitMQ](https://www.rabbitmq.com/documentation.html)
- [Kubernetes](https://kubernetes.io/docs/)
