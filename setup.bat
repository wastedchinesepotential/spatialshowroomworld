@echo off
title Nike Biomes 3D
echo ============================================
echo   Nike Biomes 3D - Y2K Activation Setup
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js / npm not found on PATH.
  echo Download from: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "public\assets" (
  echo Creating public\assets directory...
  mkdir public\assets
)

if not exist "public\assets\RyleePunkOptimized.glb" (
  echo Copying Rylee avatar from WorldDeTester...
  copy "..\WorldDeTester\public\assets\RyleePunkOptimized.glb" "public\assets\RyleePunkOptimized.glb" /Y
  if errorlevel 1 (
    echo WARNING: Could not copy Rylee model.
  )
)

if not exist "node_modules" (
  echo.
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   Starting dev server...
echo   WASD = move  |  Mouse drag = look
echo   Shift = run  |  Space = jump
echo   Browser should open automatically.
echo   Press Ctrl+C to stop the server.
echo ============================================
echo.
call npx vite --open
pause
