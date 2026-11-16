<#
  QueueMasters - one-time PostgreSQL setup when the postgres password is unknown.
  MUST be run as Administrator (right-click -> Run with PowerShell as administrator, or let the
  launcher elevate it).

  What it does, in order:
    1. Backs up pg_hba.conf, then temporarily allows password-less LOCAL connections ("trust").
    2. Restarts the PostgreSQL service so the change takes effect.
    3. Sets a new password for the postgres superuser (default: postgres - change with -NewPostgresPassword).
    4. Runs setup.sql  (creates role queuemasters / queuemasters123 and database queuemasters).
    5. Runs migrate-from-h2.sql (imports the staff accounts and sales archive from the old H2 database).
    6. Restores the original pg_hba.conf and restarts the service, so passwords are required again.
  Nothing outside PostgreSQL is touched. Only connections from this PC were ever affected.
#>
param(
    [string]$PgRoot = "C:\Program Files\PostgreSQL\18",
    [string]$ServiceName = "postgresql-x64-18",
    [string]$NewPostgresPassword = "postgres"
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$psql = Join-Path $PgRoot "bin\psql.exe"
$hba  = Join-Path $PgRoot "data\pg_hba.conf"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "ERROR: run this script as Administrator." -ForegroundColor Red; exit 1 }
if (-not (Test-Path $psql)) { Write-Host "ERROR: psql not found at $psql (pass -PgRoot)." -ForegroundColor Red; exit 1 }
if (-not (Test-Path $hba))  { Write-Host "ERROR: pg_hba.conf not found at $hba." -ForegroundColor Red; exit 1 }

$pgIsReady = Join-Path $PgRoot "bin\pg_isready.exe"
function Wait-Ready {
    # pg_isready exits 0 only once the server really accepts connections (not while "starting up").
    for ($i = 0; $i -lt 60; $i++) {
        & $pgIsReady -h localhost -p 5432 -q 2>$null
        if ($LASTEXITCODE -eq 0) { Start-Sleep -Seconds 1; return }
        Start-Sleep -Seconds 1
    }
    throw "PostgreSQL did not become ready on port 5432"
}
function Run-Psql { param([string[]]$PsqlArgs, [int]$Retries = 1)   # not $Args: that name is reserved in PowerShell
    $ErrorActionPreference = "Continue"   # native stderr must not become a terminating error here
    for ($try = 1; $try -le $Retries; $try++) {
        $out = & $psql -h localhost -w -v ON_ERROR_STOP=1 @PsqlArgs 2>&1
        if ($LASTEXITCODE -eq 0) { $out | ForEach-Object { Write-Host "      $_" }; return }
        Write-Host "      psql attempt $try failed: $($out -join ' | ')"
        if ($try -lt $Retries) { Start-Sleep -Seconds 2 }
    }
    throw "psql failed: $($PsqlArgs -join ' ')"
}

$original = [IO.File]::ReadAllText($hba)
$backup = "$hba.bak-" + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item $hba $backup
Write-Host "[1/6] Backed up pg_hba.conf -> $backup"

try {
    # Switch every active rule's method to trust (comments untouched). Local-only: the file only lists local/host rules.
    $trusted = ($original -split "`r?`n") | ForEach-Object {
        if ($_ -match '^\s*(local|host|hostssl|hostnossl)\s' -and $_ -notmatch '^\s*#') {
            $_ -replace '\b(scram-sha-256|md5|password|sspi)\b', 'trust'
        } else { $_ }
    }
    [IO.File]::WriteAllText($hba, ($trusted -join "`n"), (New-Object Text.UTF8Encoding $false))
    Write-Host "[2/6] Temporarily trusting local connections; restarting $ServiceName"
    Restart-Service $ServiceName
    Wait-Ready

    Write-Host "[3/6] Setting the postgres superuser password"
    Run-Psql -Retries 5 @("-U", "postgres", "-d", "postgres", "-c", "ALTER USER postgres PASSWORD '$NewPostgresPassword';")

    Write-Host "[4/6] Creating role + database (setup.sql)"
    Run-Psql @("-U", "postgres", "-f", (Join-Path $here "setup.sql"))

    $migrate = Join-Path $here "migrate-from-h2.sql"
    if (Test-Path $migrate) {
        Write-Host "[5/6] Importing old H2 data (migrate-from-h2.sql)"
        Run-Psql @("-U", "queuemasters", "-d", "queuemasters", "-f", $migrate)
    } else {
        Write-Host "[5/6] No migrate-from-h2.sql found - skipping import"
    }
    $ok = $true
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $ok = $false
}
finally {
    [IO.File]::WriteAllText($hba, $original, (New-Object Text.UTF8Encoding $false))
    Restart-Service $ServiceName
    Write-Host "[6/6] Restored pg_hba.conf (passwords required again) and restarted PostgreSQL"
}
if (-not $ok) { Write-Host "FAILED - nothing was changed permanently except the backup file." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "DONE." -ForegroundColor Green
Write-Host "  postgres superuser password : $NewPostgresPassword"
Write-Host "  app database                : queuemasters  (user queuemasters / queuemasters123)"
Write-Host "You can now start the system with start.bat"
