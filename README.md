# Security hardening (minimal)

- API traffic (UI → Consumer) now requires a shared token header `X-Race-Token`.  
- RabbitMQ credentials and the API token are stored in Kubernetes Secret `race-secrets`.
- Probes (`/health`) and metrics (`/metrics`) stay unauthenticated for liveness and Prometheus scraping.
- Each producer pod identifies itself via `PRODUCER_ID` (default = pod name) and tags every event. Consumers can restrict which producers they accept with `ALLOWED_PRODUCER_IDS` (comma-separated).

How to set your own credentials:
1) Edit `k8s/secrets.yaml` and change `RABBITMQ_URL` and `RACE_API_TOKEN`.
2) Apply secrets before deployments: `kubectl apply -f k8s/secrets.yaml`.
3) Deploy/refresh manifests (ArgoCD/GitHub Actions handle rollout). If manual:  
   `kubectl apply -f k8s/producer -f k8s/consumer -f k8s/ui`.

To limit UI data to known producers, set `ALLOWED_PRODUCER_IDS` in `k8s/consumer/configmap.yaml` (e.g., `producer-0,producer-1`). Use `kubectl get pods -l app=producer` to see pod names after deployment.
