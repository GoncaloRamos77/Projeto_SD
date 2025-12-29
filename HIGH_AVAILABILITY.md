# High Availability, Auto-Scaling, Low Latency, and Resilience Configuration

This document describes the comprehensive configuration for high availability (HA), automatic scaling, low latency, and high resilience implemented across all services in the Racing System.

## Table of Contents
1. [Overview](#overview)
2. [Producer Service](#producer-service)
3. [Consumer Service](#consumer-service)
4. [UI Service](#ui-service)
5. [RabbitMQ Broker](#rabbitmq-broker)
6. [Network Policies](#network-policies)
7. [Deployment Strategy](#deployment-strategy)
8. [Monitoring and Observability](#monitoring-and-observability)

---

## Overview

The system is configured with the following principles:

### High Availability
- **Multiple replicas**: All services run with 3+ replicas
- **Pod anti-affinity**: Pods spread across different nodes
- **Pod Disruption Budgets (PDB)**: Ensures minimum availability during disruptions
- **Health checks**: Liveness, readiness, and startup probes for all services

### Auto-Scaling
- **Horizontal Pod Autoscaler (HPA)**: Scales based on CPU and memory
- **Smart scaling policies**: Fast scale-up, slow scale-down
- **Range**: 3-10 replicas per service

### Low Latency
- **Resource allocation**: Adequate CPU and memory requests/limits
- **Pod anti-affinity**: Reduces node contention
- **Network policies**: Optimizes communication paths
- **Connection pooling**: Via RabbitMQ cluster

### High Resilience
- **RollingUpdate strategy**: Zero-downtime deployments
- **Graceful termination**: Proper termination grace periods
- **Circuit breakers**: Via health checks and timeouts
- **Persistent storage**: StatefulSet for RabbitMQ with PVCs

---

## Producer Service

### Configuration Details

**Replicas**: 3 (minimum) → 10 (maximum)

**Resources**:
```yaml
requests:
  memory: 256Mi
  cpu: 200m
limits:
  memory: 512Mi
  cpu: 500m
```

**Auto-Scaling Triggers**:
- CPU utilization > 70%
- Memory utilization > 80%

**High Availability Features**:
- **Pod Anti-Affinity**: Pods prefer different nodes
- **PDB**: Minimum 2 pods always available during disruptions
- **Rolling Update**: maxSurge=1, maxUnavailable=1
- **Graceful Shutdown**: 60 seconds termination grace period

**Health Checks**:
- **Liveness Probe**: `/health` endpoint, 30s initial delay
- **Readiness Probe**: `/health` endpoint, 10s initial delay
- **Startup Probe**: `/health` endpoint, allows slow starts

**Resilience**:
- Automatic restart on failures
- Quick detection of unhealthy pods
- Load distributed across multiple instances

---

## Consumer Service

### Configuration Details

**Replicas**: 3 (minimum) → 10 (maximum)

**Resources**:
```yaml
requests:
  memory: 256Mi
  cpu: 200m
limits:
  memory: 512Mi
  cpu: 500m
```

**Auto-Scaling Triggers**:
- CPU utilization > 70%
- Memory utilization > 80%

**High Availability Features**:
- **Pod Anti-Affinity**: Pods prefer different nodes
- **PDB**: Minimum 2 pods always available during disruptions
- **Rolling Update**: maxSurge=1, maxUnavailable=1
- **Graceful Shutdown**: 60 seconds termination grace period

**Health Checks**:
- **Liveness Probe**: `/health` endpoint, 30s initial delay
- **Readiness Probe**: `/health` endpoint, 10s initial delay
- **Startup Probe**: `/health` endpoint, allows slow starts

**Resilience**:
- Multiple consumers process RabbitMQ messages concurrently
- Message acknowledgment ensures no data loss
- API load balanced across all replicas

---

## UI Service

### Configuration Details

**Replicas**: 3 (minimum) → 10 (maximum)

**Resources**:
```yaml
requests:
  memory: 256Mi
  cpu: 200m
limits:
  memory: 512Mi
  cpu: 500m
```

**Auto-Scaling Triggers**:
- CPU utilization > 70%
- Memory utilization > 80%

**High Availability Features**:
- **Pod Anti-Affinity**: Pods prefer different nodes
- **PDB**: Minimum 2 pods always available during disruptions
- **Rolling Update**: maxSurge=1, maxUnavailable=1
- **Graceful Shutdown**: 30 seconds termination grace period

**Health Checks**:
- **Liveness Probe**: `/` endpoint, 30s initial delay
- **Readiness Probe**: `/` endpoint, 10s initial delay
- **Startup Probe**: `/` endpoint, allows slow starts

**Resilience**:
- Load balanced across multiple replicas
- Session-independent (stateless)
- Quick recovery from failures

---

## RabbitMQ Broker

### Configuration Details

**Deployment Type**: StatefulSet (for stable network identities and persistent storage)

**Replicas**: 3 (clustered)

**Resources**:
```yaml
requests:
  memory: 512Mi
  cpu: 500m
limits:
  memory: 1Gi
  cpu: 1000m
```

**High Availability Features**:

#### Clustering
- **3-node cluster**: Full mesh cluster for redundancy
- **Quorum queues**: Replicated across nodes (requires configuration in application)
- **Auto-heal**: Automatic partition healing
- **Min-masters**: Even queue distribution

#### Storage
- **Persistent Volumes**: 10Gi per node
- **StatefulSet**: Stable pod identities and persistent storage
- **Data replication**: Via RabbitMQ cluster

#### Network
- **Headless Service**: For cluster formation (`rabbitmq-headless`)
- **ClusterIP Service**: For client connections (`rabbitmq`)
- **NodePort Service**: For management UI (`rabbitmq-management`)

#### RBAC
- **ServiceAccount**: For Kubernetes API access
- **Role**: Allows endpoint discovery for cluster formation
- **RoleBinding**: Links ServiceAccount to Role

**Resilience**:
- **PDB**: Maximum 1 pod unavailable during disruptions
- **Pod Anti-Affinity**: Nodes spread across different hosts
- **Graceful Shutdown**: 60 seconds termination grace period
- **Startup Probe**: Up to 5 minutes for cluster formation

**Health Checks**:
- **Liveness Probe**: `rabbitmq-diagnostics ping`, 60s initial delay
- **Readiness Probe**: Port connectivity check, 20s initial delay
- **Startup Probe**: Allows extended startup time for clustering

**Monitoring**:
- Prometheus plugin enabled
- Metrics exposed on port 15692

---

## Network Policies

Network policies are configured to:

1. **Optimize Communication Paths**
   - Direct pod-to-pod communication
   - Reduced network hops

2. **Security**
   - Restrict traffic to only necessary paths
   - Producer → RabbitMQ
   - Consumer → RabbitMQ
   - UI → Consumer
   - External → UI

3. **Low Latency**
   - Allow RabbitMQ cluster communication (EPMD, dist ports)
   - No unnecessary network filtering

### Policies

- **allow-producer-to-rabbitmq**: Producer can connect to RabbitMQ on port 5672
- **allow-consumer-to-rabbitmq**: Consumer can connect to RabbitMQ on port 5672
- **allow-ui-to-consumer**: UI can connect to Consumer API on port 3001
- **allow-external-to-ui**: External traffic can reach UI on port 3000
- **RabbitMQ inter-node**: Cluster nodes can communicate on ports 4369, 25672

---

## Deployment Strategy

### Rolling Updates

All services use `RollingUpdate` strategy:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 1
```

**Benefits**:
- Zero-downtime deployments
- Gradual rollout
- Easy rollback if issues occur

### Auto-Scaling Behavior

**Scale-Up** (Fast):
- Stabilization window: 60 seconds
- Can increase by 50% or 2 pods (whichever is higher)
- Responds quickly to traffic spikes

**Scale-Down** (Conservative):
- Stabilization window: 300 seconds (5 minutes)
- Can decrease by 10% maximum
- Prevents flapping
- Ensures stability before scaling down

### Deployment Order

1. **RabbitMQ** (prerequisite)
   ```bash
   kubectl apply -f k8s/broker/rbac.yaml
   kubectl apply -f k8s/broker/configmap.yaml
   kubectl apply -f k8s/broker/service.yaml
   kubectl apply -f k8s/broker/statefulset.yaml
   kubectl apply -f k8s/broker/pdb.yaml
   ```

2. **Producer, Consumer, UI** (can be deployed in parallel)
   ```bash
   kubectl apply -f k8s/producer/
   kubectl apply -f k8s/consumer/
   kubectl apply -f k8s/ui/
   ```

3. **Network Policies** (optional, for security)
   ```bash
   kubectl apply -f k8s/network-policy.yaml
   ```

---

## Monitoring and Observability

### Metrics

All services expose Prometheus metrics:
- **Producer**: `:3002/metrics`
- **Consumer**: `:3001/metrics`
- **UI**: `:3000/metrics`
- **RabbitMQ**: `:15692/metrics`

### Grafana Dashboards

Pre-configured dashboards monitor:
- Request rates
- Latencies (P50, P95, P99)
- Error rates
- Resource usage (CPU, memory)
- Auto-scaling events

### Health Checks

Multiple probe types ensure:
- **Startup Probe**: Service initialization completed
- **Liveness Probe**: Service is alive (restart if failing)
- **Readiness Probe**: Service ready to accept traffic

---

## Configuration Summary

| Service | Min Replicas | Max Replicas | CPU Request | Memory Request | PDB Min Available |
|---------|--------------|--------------|-------------|----------------|-------------------|
| Producer | 3 | 10 | 200m | 256Mi | 2 |
| Consumer | 3 | 10 | 200m | 256Mi | 2 |
| UI | 3 | 10 | 200m | 256Mi | 2 |
| RabbitMQ | 3 | 3 | 500m | 512Mi | Max 1 unavailable |

---

## Testing High Availability

### Simulate Pod Failures

```bash
# Kill a producer pod
kubectl delete pod -l app=producer --force --grace-period=0

# Observe automatic recreation and load distribution
kubectl get pods -l app=producer -w
```

### Simulate Node Failures

```bash
# Drain a node (if you have multiple nodes)
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Observe pods rescheduling to other nodes
kubectl get pods -o wide -w
```

### Load Testing

```bash
# Scale manually to test
kubectl scale deployment producer --replicas=5

# Monitor auto-scaling
kubectl get hpa -w
```

### Check RabbitMQ Cluster

```bash
# Port-forward to management UI
kubectl port-forward svc/rabbitmq-management 15672:15672

# Access http://localhost:15672
# Username: guest, Password: guest
# Check "Nodes" tab for cluster status
```

---

## Troubleshooting

### Pods Not Scaling

1. Check metrics-server is installed:
   ```bash
   kubectl get deployment metrics-server -n kube-system
   ```

2. Check HPA status:
   ```bash
   kubectl describe hpa <hpa-name>
   ```

### RabbitMQ Cluster Not Forming

1. Check RBAC permissions:
   ```bash
   kubectl get serviceaccount rabbitmq
   kubectl get role rabbitmq
   kubectl get rolebinding rabbitmq
   ```

2. Check pod logs:
   ```bash
   kubectl logs rabbitmq-0
   ```

3. Verify headless service:
   ```bash
   kubectl get svc rabbitmq-headless
   ```

### High Latency

1. Check resource constraints:
   ```bash
   kubectl top pods
   ```

2. Check pod distribution:
   ```bash
   kubectl get pods -o wide
   ```

3. Verify network policies aren't blocking traffic:
   ```bash
   kubectl get networkpolicies
   ```

---

## Best Practices Implemented

1. ✅ **Multiple Replicas**: All services run with 3+ replicas
2. ✅ **Auto-Scaling**: HPA configured for all stateless services
3. ✅ **Pod Disruption Budgets**: Ensures minimum availability
4. ✅ **Pod Anti-Affinity**: Spreads pods across nodes
5. ✅ **Resource Limits**: Prevents resource starvation
6. ✅ **Health Checks**: Multiple probe types for each service
7. ✅ **Graceful Termination**: Proper shutdown handling
8. ✅ **Rolling Updates**: Zero-downtime deployments
9. ✅ **Persistent Storage**: StatefulSet for RabbitMQ
10. ✅ **Monitoring**: Prometheus metrics and Grafana dashboards
11. ✅ **Network Policies**: Optimized and secure communication
12. ✅ **Cluster Formation**: RabbitMQ HA cluster with auto-discovery

---

## Future Enhancements

1. **Custom Metrics**: Scale based on queue depth or request latency
2. **Multi-Region**: Deploy across multiple availability zones
3. **Service Mesh**: Istio/Linkerd for advanced traffic management
4. **Backup/Restore**: Automated backup for RabbitMQ data
5. **Chaos Engineering**: Automated failure injection testing
6. **Rate Limiting**: Prevent system overload
7. **Circuit Breakers**: Application-level resilience patterns
