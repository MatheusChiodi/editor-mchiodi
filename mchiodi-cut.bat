@echo off
rem Inicia o MChiodi Cut. Uso: mchiodi-cut.bat [slug]  (sem slug, lista os projetos)
setlocal
cd /d "%~dp0"

where pnpm >nul 2>nul || (echo pnpm nao encontrado no PATH. & pause & exit /b 1)

if not exist "node_modules" (
  echo Instalando dependencias...
  call pnpm install || (pause & exit /b 1)
)

rem build so na primeira vez; rode "pnpm cut:build" de novo depois de atualizar a UI
if not exist "cut\dist\index.html" (
  echo Gerando a interface do MChiodi Cut...
  call pnpm cut:build || (pause & exit /b 1)
)

call pnpm mce cut %*
if errorlevel 1 pause
endlocal
