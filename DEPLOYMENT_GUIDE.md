# Deployment Guide - High Availability Configuration

This guide provides step-by-step instructions to deploy the Racing System with high availability, auto-scaling, low latency, and high resilience.

## Prerequisites

1. **Kubernetes Cluster**
   - Kubernetes 1.24+
   - Multiple nodes recommended for HA (minimum 3)
   - `kubectl` configured to access the cluster

2. **Metrics Server**
   ```bash
   # Check if metrics-server is installed
   kubectl get deployment metrics-server -n kube-system
   
   # If not installed, install it
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

3. **Storage Class**
   ```bash
   # Check available storage classes
   kubectl get storageclass
   
   # Ensure you have a default storage class for RabbitMQ PVCs
   ```

## Deployment Steps

### Step 1: Deploy RabbitMQ Cluster

Deploy RabbitMQ first as it's a prerequisite for other services.

```bash
# Create RBAC resources
kubectl apply -f k8s/broker/rbac.yaml

# Create ConfigMaps
kubectl apply -f k8s/broker/configmap.yaml

# Create Services
kubectl apply -f k8s/broker/service.yaml

# Deploy StatefulSet
kubectl apply -f k8s/broker/statefulset.yaml

# Create Pod Disruption Budget
kubectl apply -f k8s/broker/pdb.yaml

# Wait for RabbitMQ cluster to be ready (this may take 2-5 minutes)
kubectl wait --for=condition=ready pod -l app=rabbitmq --timeout=300s

# Verify cluster status
kubectl get statefulset rabbitmq
kubectl get pods -l app=rabbitmq
```

**Expected Output**:
```
NAME        READY   AGE
rabbitmq    3/3     2m

NAME          READY   STATUS    RESTARTS   AGE
rabbitmq-0    1/1     Running   0          2m
rabbitmq-1    1/1     Running   0          2m
rabbitmq-2    1/1     Running   0          2m
```

### Step 2: Deploy Microservices

Deploy Producer, Consumer, and UI services.

```bash
# Deploy Producer
kubectl apply -f k8s/producer/

# Deploy Consumer
kubectl apply -f k8s/consumer/

# Deploy UI
kubectl apply -f k8s/ui/

# Wait for all deployments to be ready
kubectl wait --for=condition=available deployment/producer --timeout=120s
kubectl wait --for=condition=available deployment/consumer --timeout=120s
kubectl wait --for=condition=available deployment/ui --timeout=120s
```

**Verify Deployments**:
```bash
kubectl get deployments
kubectl get pods
kubectl get hpa
```

**Expected Output**:
```
NAME       READY   UP-TO-DATE   AVAILABLE   AGE
producer   3/3     3            3           1m
consumer   3/3     3            3           1m
ui         3/3     3            3           1m

NAME           REFERENCE            TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
producer-hpa   Deployment/producer  <unknown>/70%   3         10        3          1m
consumer-hpa   Deployment/consumer  <unknown>/70%   3         10        3          1m
ui-hpa         Deployment/ui        <unknown>/70%   3         10        3          1m
```

### Step 3: Deploy Network Policies (Optional)

For enhanced security and optimized networking:

```bash
kubectl apply -f k8s/network-policy.yaml

# Verify network policies
kubectl get networkpolicies
```

### Step 4: Deploy Monitoring (Optional)

Deploy Grafana for monitoring:

```bash
kubectl apply -f k8s/grafana/

# Wait for Grafana to be ready
kubectl wait --for=condition=available deployment/grafana --timeout=120s
```

## Verification

### Check All Resources

```bash
# Check all deployments
kubectl get deployments

# Check all pods
kubectl get pods -o wide

# Check HPA status
kubectl get hpa

# Check PDB
kubectl get pdb

# Check services
kubectl get svc
```

### Test RabbitMQ Cluster

```bash
# Port-forward to management UI
kubectl port-forward svc/rabbitmq-management 15672:15672

# Open browser: http://localhost:15672
# Login: guest/guest
# Navigate to "Nodes" tab - should show 3 nodes
```

### Test Services

```bash
# Get UI service
kubectl get svc ui

# If using NodePort
export NODE_PORT=$(kubectl get svc ui -o jsonpath='{.spec.ports[0].nodePort}')
export NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}')
echo "Access UI at: http://$NODE_IP:$NODE_PORT"

# If using port-forward
kubectl port-forward svc/ui 3000:3000
# Access at: http://localhost:3000
```

### Verify Auto-Scaling Works

```bash
# Monitor HPA in real-time
kubectl get hpa -w

# In another terminal, generate some load
# The HPA will scale up if CPU/memory thresholds are exceeded
```

### Check Metrics

```bash
# Check if metrics are available
kubectl top nodes
kubectl top pods

# Port-forward to a service and check metrics endpoint
kubectl port-forward svc/producer 3002:3002
curl http://localhost:3002/metrics
```

## Testing High Availability

### Test Pod Resilience

```bash
# Delete a producer pod
kubectl delete pod -l app=producer --field-selector=status.phase==Running | head -n 1

# Watch it automatically recreate
kubectl get pods -l app=producer -w

# Service should remain available throughout
```

### Test Auto-Scaling

```bash
# Manually scale up to verify HPA
kubectl scale deployment producer --replicas=5

# Watch HPA adjust
kubectl get hpa producer-hpa -w

# HPA will eventually scale back down to min replicas
```

### Test RabbitMQ HA

```bash
# Delete one RabbitMQ pod
kubectl delete pod rabbitmq-1

# Watch it recreate and rejoin cluster
kubectl get pods -l app=rabbitmq -w

# Check cluster status in management UI
```

## Accessing Services

### UI Service

```bash
# Option 1: Port-forward
kubectl port-forward svc/ui 3000:3000
# Access: http://localhost:3000

# Option 2: NodePort (if exposed)
kubectl get svc ui
# Note the NodePort and access via node IP
```

### RabbitMQ Management

```bash
kubectl port-forward svc/rabbitmq-management 15672:15672
# Access: http://localhost:15672
# Credentials: guest/guest
```

### Grafana

```bash
kubectl port-forward svc/grafana 3000:3000
# Access: http://localhost:3000
# Credentials: admin/admin
```

### Producer/Consumer Metrics

```bash
# Producer
kubectl port-forward svc/producer 3002:3002
curl http://localhost:3002/metrics

# Consumer
kubectl port-forward svc/consumer 3001:3001
curl http://localhost:3001/metrics
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods

# Describe pod to see events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Check previous logs if pod restarted
kubectl logs <pod-name> --previous
```

### HPA Not Working

```bash
# Check metrics-server
kubectl get deployment metrics-server -n kube-system

# Check HPA status
kubectl describe hpa <hpa-name>

# Check if metrics are available
kubectl top pods
```

### RabbitMQ Cluster Issues

```bash
# Check StatefulSet
kubectl get statefulset rabbitmq

# Check each pod
kubectl logs rabbitmq-0
kubectl logs rabbitmq-1
kubectl logs rabbitmq-2

# Check RBAC
kubectl get serviceaccount rabbitmq
kubectl get role rabbitmq
kubectl get rolebinding rabbitmq

# Exec into pod to check cluster status
kubectl exec -it rabbitmq-0 -- rabbitmqctl cluster_status
```

### Network Issues

```bash
# Check services
kubectl get svc

# Check endpoints
kubectl get endpoints

# Check network policies
kubectl get networkpolicies

# Test connectivity between pods
kubectl exec -it <producer-pod> -- curl http://rabbitmq:5672
kubectl exec -it <ui-pod> -- curl http://consumer:3001/health
```

## Rollback

If you need to rollback a deployment:

```bash
# View deployment history
kubectl rollout history deployment/<deployment-name>

# Rollback to previous version
kubectl rollout undo deployment/<deployment-name>

# Rollback to specific revision
kubectl rollout undo deployment/<deployment-name> --to-revision=<revision>

# Check rollout status
kubectl rollout status deployment/<deployment-name>
```

## Cleanup

To remove all resources:

```bash
# Delete in reverse order
kubectl delete -f k8s/grafana/
kubectl delete -f k8s/ui/
kubectl delete -f k8s/consumer/
kubectl delete -f k8s/producer/
kubectl delete -f k8s/broker/
kubectl delete -f k8s/network-policy.yaml

# Delete PVCs (RabbitMQ data)
kubectl delete pvc -l app=rabbitmq
```

## Configuration Summary

After deployment, you should have:

- **9 application pods** (3 producer + 3 consumer + 3 ui)
- **3 RabbitMQ pods** (clustered)
- **1 Grafana pod** (optional)
- **3 HPA resources** (producer, consumer, ui)
- **4 PDB resources** (producer, consumer, ui, rabbitmq)
- **Network policies** (optional)
- **Auto-scaling** enabled for all stateless services

## Next Steps

1. **Configure monitoring alerts** in Grafana
2. **Set up CI/CD pipelines** for automated deployments
3. **Test failover scenarios** to validate HA
4. **Tune resource limits** based on actual usage
5. **Implement application-level health checks** for better reliability

## Support

For detailed configuration information, see:
- [HIGH_AVAILABILITY.md](HIGH_AVAILABILITY.md) - Comprehensive HA documentation
- [PROMETHEUS_METRICS.md](PROMETHEUS_METRICS.md) - Metrics documentation
- [k8s/grafana/README.md](k8s/grafana/README.md) - Grafana setup
