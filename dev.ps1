# DEV local: Postgres + API + nginx en tu maquina (NO toca PROD)
if (NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Set-Location $PSScriptRoot

Write-Host "Bajando contenedores previos..." -ForegroundColor Cyan
docker compose down

Write-Host "Buildeando imagenes..." -ForegroundColor Cyan
docker compose build

Write-Host "Levantando stack (db -> backend -> nginx)..." -ForegroundColor Cyan
docker compose up -d

Write-Host "Esperando health check del backend..." -ForegroundColor Cyan
$ok = $false
for ($i = 1; $i -le 45; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:5000/health' -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
}
if ($ok) { Write-Host "Backend OK (http://localhost:5000/health)" -ForegroundColor Green }
else { Write-Host "Aviso: el backend no responde /health aun (revisa: docker compose logs backend)" -ForegroundColor Yellow }

Write-Host "Abriendo puertos en Firewall..." -ForegroundColor Cyan
netsh advfirewall firewall add rule name="GastAr Backend 5000" dir=in action=allow protocol=TCP localport=5000 2>$null | Out-Null
netsh advfirewall firewall add rule name="GastAr Frontend 80" dir=in action=allow protocol=TCP localport=80 2>$null | Out-Null

$lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -notlike '172.*' } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "DEV local listo!" -ForegroundColor Green
Write-Host "  QA local (bundle):   http://localhost        (o http://$lan desde el celular)"
Write-Host "  Desarrollo (Vite):   cd frontend; npm run dev  ->  http://localhost:5173"
Write-Host "  API:                 http://localhost:5000"
Write-Host ""
Read-Host "Presiona Enter para terminar..."
