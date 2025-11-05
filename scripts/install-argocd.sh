#!/bin/bash

echo "=== Instalando ArgoCD no cluster local ==="

# Criar namespace para ArgoCD
echo "Criando namespace argocd..."
kubectl create namespace argocd

# Instalar ArgoCD
echo "Instalando ArgoCD..."
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Aguardar ArgoCD estar pronto
echo "Aguardando ArgoCD ficar pronto..."
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

# Expor ArgoCD via NodePort para acesso local
echo "Expondo ArgoCD via NodePort..."
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort", "ports": [{"port": 443, "targetPort": 8080, "nodePort": 30443, "name": "https"}]}}'

# Obter senha inicial do admin
echo ""
echo "=== ArgoCD Instalado com Sucesso! ==="
echo ""
echo "Acesso:"
echo "  URL: https://localhost:30443"
echo "  Username: admin"
echo -n "  Password: "
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo ""
echo ""
echo "Para fazer login via CLI:"
echo "  argocd login localhost:30443 --insecure"
echo ""
