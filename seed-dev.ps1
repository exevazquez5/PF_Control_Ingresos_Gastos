$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$latest = Get-ChildItem 'backups' -Filter '*.dump' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) { throw 'No hay backups en backups\. Ejecuta primero .\backup-prod.ps1' }
$running = docker compose ps -q db
if (-not $running) { throw 'El contenedor db no esta corriendo. Ejecuta antes .\dev.ps1' }
Write-Host "Restaurando $($latest.Name) en la BD DEV local..." -ForegroundColor Cyan
docker compose cp $latest.FullName 'db:/tmp/seed.dump'
if ($LASTEXITCODE -ne 0) { throw 'docker compose cp fallo' }
docker compose exec -T db psql -U postgres -d postgres -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
if ($LASTEXITCODE -ne 0) { throw 'DROP SCHEMA fallo' }
docker compose exec -T db pg_restore -U postgres -d postgres -n public --no-owner --no-privileges /tmp/seed.dump
if ($LASTEXITCODE -ne 0) { throw "pg_restore fallo (exit $LASTEXITCODE)" }
docker compose exec -T db rm -f /tmp/seed.dump
Write-Host 'Seed OK: la BD local ahora tiene los datos de PROD' -ForegroundColor Green
