This folder contains monitoring manifests and Grafana dashboards for the Race Streaming System.

- ServiceMonitors: `monitoring/servicemonitors/` - ServiceMonitor CRDs for Prometheus Operator to scrape the services (producer, consumer, ui).
- Grafana dashboards: `monitoring/grafana/` - simple dashboard JSON files for import into Grafana.

How to apply:
1. Ensure Prometheus Operator (and Grafana) is installed in the cluster.
2. Apply ServiceMonitors:
   kubectl apply -f monitoring/servicemonitors/
3. Import dashboards into Grafana (UI > Manage > Import) using the JSON files.

Notes:
- Each service exposes `/metrics` on its existing HTTP port.
- If not using Prometheus Operator, you can configure Prometheus `scrape_configs` to scrape the services' `/metrics` endpoints instead.