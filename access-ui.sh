#!/bin/bash

echo "🔍 Checking UI service access method..."
echo ""

# Get service info
EXTERNAL_IP=$(kubectl get svc ui -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
EXTERNAL_HOST=$(kubectl get svc ui -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
NODE_PORT=$(kubectl get svc ui -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)

# Check if service exists
if ! kubectl get svc ui &>/dev/null; then
    echo "❌ UI service not found. Make sure the application is deployed."
    exit 1
fi

# Determine access method
if [ -n "$EXTERNAL_IP" ] && [ "$EXTERNAL_IP" != "<pending>" ]; then
    echo "✅ LoadBalancer with External IP detected"
    echo "🌐 UI available at: http://$EXTERNAL_IP"
    echo ""
    echo "Opening browser..."
    case "$(uname -s)" in
        Darwin) open "http://$EXTERNAL_IP" ;;
        Linux) xdg-open "http://$EXTERNAL_IP" 2>/dev/null || echo "Please open http://$EXTERNAL_IP in your browser" ;;
        *) echo "Please open http://$EXTERNAL_IP in your browser" ;;
    esac
elif [ -n "$EXTERNAL_HOST" ] && [ "$EXTERNAL_HOST" != "<pending>" ]; then
    echo "✅ LoadBalancer with hostname detected"
    echo "🌐 UI available at: http://$EXTERNAL_HOST"
    echo ""
    echo "Opening browser..."
    case "$(uname -s)" in
        Darwin) open "http://$EXTERNAL_HOST" ;;
        Linux) xdg-open "http://$EXTERNAL_HOST" 2>/dev/null || echo "Please open http://$EXTERNAL_HOST in your browser" ;;
        *) echo "Please open http://$EXTERNAL_HOST in your browser" ;;
    esac
else
    echo "⚠️  No external LoadBalancer IP available"
    echo "🔄 Setting up port-forward..."
    echo ""
    echo "📡 UI will be available at: http://localhost:8080"
    echo ""
    echo "Press Ctrl+C to stop port-forwarding"
    echo "----------------------------------------"
    kubectl port-forward svc/ui 8080:80
fi
