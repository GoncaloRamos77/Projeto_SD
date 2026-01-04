# Accessing Services Across Different Clusters

The application services (UI and Grafana) are configured with `LoadBalancer` type, which works on both local and remote clusters.

## Getting the Service URL

Run this command to get the external IP/URL for accessing services:

```bash
kubectl get svc ui grafana
```

You'll see output like:
```
NAME      TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)        AGE
ui        LoadBalancer   10.96.xxx.xxx   <pending/IP>    80:xxxxx/TCP   1m
grafana   LoadBalancer   10.96.xxx.xxx   <pending/IP>    80:xxxxx/TCP   1m
```

## Access Methods by Cluster Type

### 1. Docker Desktop / Local Kubernetes (Mac/Windows)
- **EXTERNAL-IP**: Shows `localhost` or `127.0.0.1`
- **UI Access**: http://localhost:8080
- **Grafana Access**: http://localhost:3000

Note: Docker Desktop assigns `localhost` to all LoadBalancer services, so we use different ports to avoid conflicts.

### 2. Remote Cluster with LoadBalancer Support
- **EXTERNAL-IP**: Shows a real IP address (e.g., `203.0.113.10`)
- **UI Access**: http://<EXTERNAL-IP>:8080
- **Grafana Access**: http://<EXTERNAL-IP-of-grafana>:3000

### 3. Remote Cluster WITHOUT LoadBalancer (EXTERNAL-IP shows `<pending>`)

If the EXTERNAL-IP stays `<pending>`, use `kubectl port-forward`:

#### Access UI:
```bash
kubectl port-forward svc/ui 8080:8080
```
Then open: http://localhost:8080

#### Access Grafana:
```bash
kubectl port-forward svc/grafana 3000:3000
```
Then open: http://localhost:3000

## Quick Access Script

Save this as `access-ui.sh`:

```bash
#!/bin/bash
EXTERNAL_IP=$(kubectl get svc ui -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
EXTERNAL_HOST=$(kubectl get svc ui -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

if [ -n "$EXTERNAL_IP" ]; then
    echo "UI available at: http://$EXTERNAL_IP"
elif [ -n "$EXTERNAL_HOST" ]; then
    echo "UI available at: http://$EXTERNAL_HOST"
else
    echo "No external access configured. Starting port-forward..."
    echo "Access UI at: http://localhost:8080"
    kubectl port-forward svc/ui 8080:80
fi
```

Make it executable:
```bash
chmod +x access-ui.sh
./access-ui.sh
```

## Troubleshooting

### Services not accessible
1. Check service status: `kubectl get svc ui grafana -o wide`
2. Check pods are running: `kubectl get pods`
3. Check logs: `kubectl logs -l app=ui`

### Port conflicts on local cluster
If `localhost:80` is taken, the service will use a different port shown in `PORT(S)` column, e.g., `80:32567/TCP` means access via `localhost:32567`.

### Remote cluster security
If your remote cluster requires specific networking policies or has firewall rules, you may need to:
- Configure SecurityGroups/Firewall rules to allow port 80
- Use `kubectl port-forward` as a workaround
- Contact your cluster administrator
