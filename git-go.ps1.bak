# git-go.ps1
# Script de Automação Total do Git (Add, Commit, Pull, Push)

Write-Host "🚀 Iniciando fluxo Git Auto..." -ForegroundColor Cyan

# 1. Adicionar tudo
Write-Host "➕ Adicionando mudanças..." -ForegroundColor Gray
git add -A

# 2. Commit automático
$status = git status --porcelain
if ($null -ne $status -and $status.Length -gt 0) {
    Write-Host "💾 Criando commit automático..." -ForegroundColor Yellow
    git commit -m "auto"
} else {
    Write-Host "✨ Nada para commitar." -ForegroundColor Green
}

# 3. Pull com Rebase (para evitar conflitos de merge)
Write-Host "📥 Sincronizando com o servidor (Pull --rebase)..." -ForegroundColor Cyan
git pull --rebase

# 4. Push
Write-Host "📤 Enviando para o GitHub..." -ForegroundColor Green
git push

Write-Host "✅ Fluxo concluído com sucesso!" -ForegroundColor Green
