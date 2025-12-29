# Prometheus Metrics Documentation

## Overview
All microservices now expose Prometheus metrics at the `/metrics` endpoint. These metrics can be scraped by Prometheus or any compatible monitoring system.

## Metrics Endpoints

### Producer Service
- **Endpoint**: `http://producer:3002/metrics`
- **Health Check**: `http://producer:3002/health`

#### Custom Metrics
| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `race_events_published_total` | Counter | Total number of race events published to RabbitMQ | `race_id` |
| `race_active_races` | Gauge | Number of currently active races | - |
| `race_active_participants` | Gauge | Number of currently active participants across all races | - |
| `race_publish_latency_seconds` | Histogram | Latency of publishing events to RabbitMQ | - |

### Consumer Service
- **Endpoint**: `http://consumer:3001/metrics`
- **Health Check**: `http://consumer:3001/health`

#### Custom Metrics
| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `race_messages_consumed_total` | Counter | Total number of messages consumed from RabbitMQ | `race_id` |
| `race_api_requests_total` | Counter | Total number of API requests | `method`, `endpoint`, `status` |
| `race_api_duration_seconds` | Histogram | API request duration in seconds | `method`, `endpoint` |
| `race_consumer_races_tracked` | Gauge | Number of races currently being tracked | - |

### UI Service
- **Endpoint**: `http://ui:3000/metrics`
- **Health Check**: `http://ui:3000/health`

#### Custom Metrics
| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `race_ui_http_requests_total` | Counter | Total number of HTTP requests | `method`, `path`, `status` |
| `race_ui_proxy_latency_seconds` | Histogram | Latency of proxying requests to consumer API | - |
| `race_ui_request_duration_seconds` | Histogram | HTTP request duration in seconds | `method`, `path` |

## Default Node.js Metrics

All services also expose standard Node.js metrics provided by `prom-client`:

- **Process Metrics**:
  - `process_cpu_user_seconds_total` - User CPU time
  - `process_cpu_system_seconds_total` - System CPU time
  - `process_resident_memory_bytes` - Resident memory size
  - `process_heap_bytes` - Process heap size

- **Node.js Metrics**:
  - `nodejs_eventloop_lag_seconds` - Event loop lag
  - `nodejs_active_handles_total` - Number of active handles
  - `nodejs_active_requests_total` - Number of active requests
  - `nodejs_heap_size_total_bytes` - Total heap size
  - `nodejs_heap_size_used_bytes` - Used heap size
  - `nodejs_external_memory_bytes` - External memory usage

## Kubernetes Integration

All deployments have been annotated for Prometheus service discovery:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "<service-port>"
  prometheus.io/path: "/metrics"
```

When Prometheus is deployed with Kubernetes service discovery, it will automatically discover and scrape these endpoints.

## Example Queries

### Producer Metrics
```promql
# Events published per race
rate(race_events_published_total[5m])

# Active races over time
race_active_races

# Average publish latency
rate(race_publish_latency_seconds_sum[5m]) / rate(race_publish_latency_seconds_count[5m])
```

### Consumer Metrics
```promql
# Messages consumed per second
rate(race_messages_consumed_total[5m])

# API request rate by endpoint
rate(race_api_requests_total[5m])

# API latency P95
histogram_quantile(0.95, rate(race_api_duration_seconds_bucket[5m]))
```

### UI Metrics
```promql
# HTTP request rate
rate(race_ui_http_requests_total[5m])

# Proxy latency P99
histogram_quantile(0.99, rate(race_ui_proxy_latency_seconds_bucket[5m]))

# Error rate
rate(race_ui_http_requests_total{status=~"5.."}[5m])
```

## Testing Locally

### Without Kubernetes
If running services locally with Node.js:

```bash
# Producer metrics
curl http://localhost:3002/metrics

# Consumer metrics
curl http://localhost:3001/metrics

# UI metrics
curl http://localhost:3000/metrics
```

### With Kubernetes
If services are deployed in Kubernetes:

```bash
# Port-forward to access metrics
kubectl port-forward service/producer 3002:3002
kubectl port-forward service/consumer 3001:3001
kubectl port-forward service/ui 3000:3000

# Then access via localhost
curl http://localhost:3002/metrics
curl http://localhost:3001/metrics
curl http://localhost:3000/metrics
```

## Grafana Dashboard Suggestions

### Key Panels to Create

1. **System Overview**
   - Total events published
   - Active races
   - Active participants
   - Messages consumed

2. **Performance Metrics**
   - Publish latency (P50, P95, P99)
   - API response time (P50, P95, P99)
   - Proxy latency

3. **Resource Usage**
   - Memory usage per service
   - CPU usage per service
   - Event loop lag

4. **Request Rates**
   - Events published/sec by race
   - API requests/sec by endpoint
   - UI requests/sec by path

5. **Error Tracking**
   - HTTP error rates (4xx, 5xx)
   - Failed message processing

## Next Steps

To complete the monitoring setup:

1. **Deploy Prometheus** to the Kubernetes cluster to scrape these metrics
2. **Deploy Grafana** for visualization
3. **Create dashboards** based on the metrics above
4. **Set up alerts** for critical metrics (high latency, error rates, etc.)
