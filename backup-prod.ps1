$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$Image = 'postgres:17-alpine'
if (-not (Test-Path '.env.prod')) { throw 'Falta .env.prod (debe contener ConnectionStrings__DefaultConnection de PROD)' }
$line = (Get-Content '.env.prod' | Where-Object { $_ -like 'ConnectionStrings__DefaultConnection=*' } | Select-Object -First 1) -replace '^ConnectionStrings__DefaultConnection=', ''
$pairs = @{}
foreach ($kv in ($line -split ';')) {
    $i = $kv.IndexOf('=')
    if ($i -gt 0) { $pairs[$kv.Substring(0, $i).Trim()] = $kv.Substring($i + 1).Trim() }
}
foreach ($k in 'Host', 'Port', 'Username', 'Database', 'Password') { if (-not $pairs[$k]) { throw "Falta '$k' en la cadena de conexion de .env.prod" } }
New-Item -ItemType Directory -Force -Path 'backups' | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = "prod-$stamp.dump"
docker run --rm -e "PGPASSWORD=$($pairs['Password'])" -e PGSSLMODE=require -v "${PWD}\backups:/backup" $Image pg_dump -h $pairs['Host'] -p $pairs['Port'] -U $pairs['Username'] -d $pairs['Database'] -Fc -f "/backup/$out"
if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo (exit $LASTEXITCODE)" }
Write-Host "Backup OK: backups\$out" -ForegroundColor Green
