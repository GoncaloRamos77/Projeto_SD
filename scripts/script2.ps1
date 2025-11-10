# Script PowerShell para configurar a ArgoCD Application

Write-Host "=== Configurando ArgoCD Application ==="

# Verificar se o repositório Git está configurado
$REPO_URL = git config --get remote.origin.url

if ([string]::IsNullOrEmpty($REPO_URL)) {
    Write-Host "Erro: Repositório Git não configurado!"
    Write-Host "Execute: git remote add origin <URL_DO_REPOSITORIO>"
    # Em PowerShell, 'exit 1' pode fechar a janela. 'return' para o script.
    return
}

Write-Host "Repositório detectado: $REPO_URL"

# Atualizar application.yaml com o URL do repositório
$HTTPS_URL = $REPO_URL

if ($REPO_URL -like "git@*") {
    # Converter SSH para HTTPS (específico para GitHub)
    Write-Host "Convertendo URL SSH para HTTPS..."
    $HTTPS_URL = $REPO_URL -replace "git@github.com:", "https://github.com/"
    $HTTPS_URL = $HTTPS_URL -replace "\.git$", ""
}
else {
    $HTTPS_URL = $REPO_URL -replace "\.git$", ""
}

$filePath = "argocd/application.yaml"
$replacementLine = "repoURL: $($HTTPS_URL).git"

if (Test-Path $filePath) {
    Write-Host "Atualizando $filePath..."
    
    # Equivalente ao 'sed -i' (lê, substitui e salva no mesmo ficheiro)
    # A lógica 'repoURL:.*' substitui a linha inteira que começa com 'repoURL:'
    (Get-Content $filePath) -replace "repoURL:.*", $replacementLine | Set-Content $filePath

    # Aplicar Application no ArgoCD
    Write-Host "Aplicando Application no ArgoCD..."
    kubectl apply -f $filePath
} else {
    Write-Host "Erro: Ficheiro $filePath não encontrado!"
    return
}

Write-Host ""
Write-Host "=== ArgoCD Application Configurado! ==="
Write-Host ""
Write-Host "Para verificar o status:"
Write-Host "  kubectl get applications -n argocd"
Write-Host ""
Write-Host "Para ver logs do ArgoCD:"
Write-Host "  kubectl logs -n argocd deployment/argocd-application-controller"
Write-Host ""