# Auto-elevar a administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# Correr desde la carpeta del proyecto
Set-Location $PSScriptRoot

Write-Host "Bajando contenedores..." -ForegroundColor Cyan
docker compose down

Write-Host "Buildeando imagenes..." -ForegroundColor Cyan
docker compose build --no-cache

Write-Host "Levantando contenedores..." -ForegroundColor Cyan
docker compose up -d

Write-Host "Abriendo puertos en Firewall..." -ForegroundColor Cyan
netsh advfirewall firewall add rule name="GastAr Backend 5000" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="GastAr Frontend 80" dir=in action=allow protocol=TCP localport=80

Write-Host "Deploy completado!" -ForegroundColor Green
Write-Host "PC:      http://localhost" -ForegroundColor Green
Write-Host "Celular: http://192.168.1.46" -ForegroundColor Green
Read-Host "Presiona Enter para terminar..."