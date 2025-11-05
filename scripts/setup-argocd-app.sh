#!/bin/bash

echo "=== Configurando ArgoCD Application ==="

# Verificar se o repositório Git está configurado
REPO_URL=$(git config --get remote.origin.url)
if [ -z "$REPO_URL" ]; then
    echo "Erro: Repositório Git não configurado!"
    echo "Execute: git remote add origin <URL_DO_REPOSITORIO>"
    exit 1
fi

echo "Repositório detectado: $REPO_URL"

# Atualizar application.yaml com o URL do repositório
if [[ "$REPO_URL" == git@* ]]; then
    # Converter SSH para HTTPS
    HTTPS_URL=$(echo $REPO_URL | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')
else
    HTTPS_URL=$(echo $REPO_URL | sed 's/\.git$//')
fi

echo "Atualizando argocd/application.yaml..."
sed -i.bak "s|repoURL:.*|repoURL: $HTTPS_URL.git|g" argocd/application.yaml
rm -f argocd/application.yaml.bak

# Aplicar Application no ArgoCD
echo "Aplicando Application no ArgoCD..."
kubectl apply -f argocd/application.yaml

echo ""
echo "=== ArgoCD Application Configurado! ==="
echo ""
echo "Para verificar o status:"
echo "  kubectl get applications -n argocd"
echo ""
echo "Para ver logs do ArgoCD:"
echo "  kubectl logs -n argocd deployment/argocd-application-controller"
echo ""
