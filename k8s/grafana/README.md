# Grafana Deployment

This directory contains Kubernetes manifests for deploying Grafana with pre-configured dashboards for the Racing System.

## Contents

- `deployment.yaml` - Grafana deployment configuration
- `service.yaml` - Grafana service (NodePort)
- `datasource.yaml` - ConfigMap for Prometheus datasource
- `dashboard-config.yaml` - ConfigMap for dashboard provisioning
- `dashboards.yaml` - ConfigMap containing the Racing System Overview dashboard

## Dashboard Features

The **Racing System Overview** dashboard includes:

### System Metrics
- Active races count
- Active participants count
- Events published rate per race
- Messages consumed rate per race
- UI HTTP request rate

### Performance Metrics
- Producer publish latency (P50, P95, P99)
- Consumer API latency (P50, P95, P99)
- UI proxy latency (P50, P95, P99)

### Resource Usage
- Memory usage by service
- CPU usage by service
- Event loop lag by service

### Error Tracking
- Consumer API error rates (4xx, 5xx)
- UI error rates (4xx, 5xx)

## Prerequisites

- Kubernetes cluster running
- Prometheus deployed and accessible at `http://prometheus:9090`
- All microservices (producer, consumer, ui) exposing metrics

## Deployment

Deploy all Grafana components:

```bash
kubectl apply -f k8s/grafana/
```

Or deploy individually:

```bash
kubectl apply -f k8s/grafana/datasource.yaml
kubectl apply -f k8s/grafana/dashboard-config.yaml
kubectl apply -f k8s/grafana/dashboards.yaml
kubectl apply -f k8s/grafana/deployment.yaml
kubectl apply -f k8s/grafana/service.yaml
```

## Access Grafana

### Get the NodePort

```bash
kubectl get service grafana
```

### Access via NodePort

```bash
# Get the node IP
kubectl get nodes -o wide

# Access Grafana at http://<NODE_IP>:<NODE_PORT>
```

### Access via Port Forward

```bash
kubectl port-forward service/grafana 3000:3000
```

Then access Grafana at http://localhost:3000

## Login Credentials

- **Username**: `admin`
- **Password**: `admin`

**Note**: For production, change the default password by updating the `GF_SECURITY_ADMIN_PASSWORD` environment variable in `deployment.yaml`.

## Dashboard Access

Once logged in:
1. Navigate to **Dashboards** in the left sidebar
2. Select **Racing System Overview**
3. The dashboard will display all metrics from your services

## Customization

### Change Prometheus URL

If your Prometheus is not at `http://prometheus:9090`, edit `datasource.yaml`:

```yaml
data:
  datasources.yaml: |
    datasources:
    - name: Prometheus
      url: http://your-prometheus-url:9090
```

### Add More Dashboards

Add additional dashboard JSON to the `dashboards.yaml` ConfigMap:

```yaml
data:
  racing-overview.json: |
    { ... existing dashboard ... }
  new-dashboard.json: |
    { ... new dashboard JSON ... }
```

## Verification

Check if Grafana is running:

```bash
kubectl get pods -l app=grafana
kubectl logs -l app=grafana
```

Check datasource connection:
1. Login to Grafana
2. Go to **Configuration** → **Data Sources**
3. Click on **Prometheus**
4. Click **Test** at the bottom

## Troubleshooting

### Dashboard not appearing
- Check ConfigMaps: `kubectl get configmaps | grep grafana`
- Restart Grafana pod: `kubectl delete pod -l app=grafana`

### No data in panels
- Verify Prometheus URL is correct
- Check services are exposing metrics: `kubectl port-forward service/producer 3002:3002` then `curl http://localhost:3002/metrics`
- Verify Prometheus is scraping targets

### Cannot access Grafana
- Check service: `kubectl get svc grafana`
- Check pod status: `kubectl get pods -l app=grafana`
- Check logs: `kubectl logs -l app=grafana`
