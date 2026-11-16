@echo off
setlocal EnableDelayedExpansion
title QueueMasters launcher
cd /d "%~dp0"

echo.
echo  =========================================
echo     QueueMasters - starting the system
echo  =========================================
echo.

rem ---------- 1. Find a Java 17+ installation ----------
set "JAVA_FOUND="
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_FOUND=%JAVA_HOME%"

if not defined JAVA_FOUND (
    for %%D in (
        "C:\Program Files\Android\openjdk\jdk-21.0.8"
        "C:\Program Files\Android\Android Studio\jbr"
    ) do if not defined JAVA_FOUND if exist "%%~D\bin\java.exe" set "JAVA_FOUND=%%~D"
)
if not defined JAVA_FOUND (
    for /d %%D in ("C:\Program Files\Java\jdk-*" "C:\Program Files\Eclipse Adoptium\jdk-*" "C:\Program Files\Microsoft\jdk-*" "C:\Program Files\Android\openjdk\jdk-*" "C:\Program Files\JetBrains\*" "%USERPROFILE%\.jdks\*" "%USERPROFILE%\.gradle\jdks\*") do (
        if not defined JAVA_FOUND (
            if exist "%%~D\bin\java.exe" set "JAVA_FOUND=%%~D"
            if exist "%%~D\jbr\bin\java.exe" set "JAVA_FOUND=%%~D\jbr"
        )
    )
)
if not defined JAVA_FOUND (
    where java >nul 2>nul && for /f "delims=" %%J in ('where java') do if not defined JAVA_FOUND for %%P in ("%%~dpJ..") do set "JAVA_FOUND=%%~fP"
)
if not defined JAVA_FOUND (
    echo  [X] Java 17 or newer was not found.
    echo      Install it from https://adoptium.net and run this file again.
    pause
    exit /b 1
)
echo  [OK] Java:  %JAVA_FOUND%

rem ---------- 2. Check Node ----------
where npm >nul 2>nul
if errorlevel 1 (
    echo  [X] Node.js was not found. Install it from https://nodejs.org and run this file again.
    pause
    exit /b 1
)
echo  [OK] Node:  found

rem ---------- 2b. Check PostgreSQL (port 5432) ----------
powershell -NoProfile -Command "exit [int](-not (Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -InformationLevel Quiet))" >nul 2>nul
if errorlevel 1 (
    echo  [..] PostgreSQL is not listening on port 5432 - trying to start the Windows service...
    for /f "tokens=*" %%S in ('powershell -NoProfile -Command "(Get-Service | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1).Name"') do net start "%%S" >nul 2>nul
    powershell -NoProfile -Command "exit [int](-not (Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -InformationLevel Quiet))" >nul 2>nul
    if errorlevel 1 (
        echo  [X] PostgreSQL is not running. Install it from https://www.postgresql.org/download/windows/
        echo      then run backend\db\setup.sql once ^(see README^) and start this file again.
        pause
        exit /b 1
    )
)
echo  [OK] PostgreSQL: listening on 5432

rem ---------- 3. Free the ports if an old copy is still running ----------
for %%P in (8080 3000) do (
    for /f "tokens=5" %%I in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
        echo  [..] Port %%P is busy ^(PID %%I^) - stopping the old process
        taskkill /PID %%I /F >nul 2>nul
    )
)

rem ---------- 4. Backend ----------
echo  [..] Starting backend on http://localhost:8080  (first run downloads Maven - be patient)
start "QueueMasters BACKEND (port 8080)" cmd /k "set "JAVA_HOME=%JAVA_FOUND%" && set "PATH=%JAVA_FOUND%\bin;%PATH%" && cd /d "%~dp0backend" && mvnw.cmd spring-boot:run"

rem ---------- 5. Frontend ----------
if not exist "frontend\node_modules" (
    echo  [..] Installing frontend packages - one time only...
    pushd frontend
    call npm install --no-audit --no-fund
    popd
)
echo  [..] Starting frontend on http://localhost:3000
start "QueueMasters FRONTEND (port 3000)" cmd /k "cd /d "%~dp0frontend" && set BROWSER=none && npm start"

rem ---------- 6. Wait for the backend, then open the browser ----------
echo  [..] Waiting for the backend to come up...
set /a TRIES=0
:wait
set /a TRIES+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:8080/api/bookings) | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
    if !TRIES! GEQ 90 (
        echo  [!] Backend is taking long - check the BACKEND window for errors.
        goto open
    )
    timeout /t 2 /nobreak >nul
    goto wait
)
echo  [OK] Backend is up.

:open
timeout /t 3 /nobreak >nul
start "" http://localhost:3000
echo.
echo  QueueMasters is running:  http://localhost:3000
echo  Close the BACKEND and FRONTEND windows to stop it.
echo.
pause
