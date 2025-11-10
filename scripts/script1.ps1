# Script PowerShell para instalar o ArgoCD

Write-Host "=== Instalando ArgoCD no cluster local ==="

# Criar namespace para ArgoCD
Write-Host "Criando namespace argocd..."
kubectl create namespace argocd

# Instalar ArgoCD
Write-Host "Instalando ArgoCD..."
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Aguardar ArgoCD estar pronto
Write-Host "Aguardando ArgoCD ficar pronto..."
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

# Expor ArgoCD via NodePort para acesso local
Write-Host "Expondo ArgoCD via NodePort..."
# Nota: O JSON deve estar em linha única para o comando patch
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort", "ports": [{"port": 443, "targetPort": 8080, "nodePort": 30443, "name": "https"}]}}'

# Obter senha inicial do admin
Write-Host ""
Write-Host "=== ArgoCD Instalado com Sucesso! ==="
Write-Host ""
Write-Host "Acesso:"
Write-Host "  URL: https://localhost:30443"
Write-Host "  Username: admin"

# Obter e descodificar a senha em PowerShell
Write-Host -NoNewline "  Password: "
$base64Password = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
if ($base64Password) {
    $password = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($base64Password))
    Write-Host $password
} else {
    Write-Host "Não foi possível obter a senha."
}

Write-Host ""
Write-Host ""
Write-Host "Para fazer login via CLI:"
Write-Host "  argocd login localhost:30443 --insecure"
Write-Host ""