# Security hardening (minimal)

- API traffic (UI → Consumer) now requires a shared token header `X-Race-Token`.  
- RabbitMQ credentials and the API token are stored in Kubernetes Secret `race-secrets`.
- Probes (`/health`) and metrics (`/metrics`) stay unauthenticated for liveness and Prometheus scraping.

How to set your own credentials:
1) Edit `k8s/secrets.yaml` and change `RABBITMQ_URL` and `RACE_API_TOKEN`.
2) Apply secrets before deployments: `kubectl apply -f k8s/secrets.yaml`.
3) Deploy/refresh manifests (ArgoCD/GitHub Actions handle rollout). If manual:  
   `kubectl apply -f k8s/producer -f k8s/consumer -f k8s/ui`.
