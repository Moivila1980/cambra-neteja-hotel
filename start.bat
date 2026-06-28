@echo off
REM Arrenca l'app Cambra en un servidor local sense cache i obre el navegador.
cd /d "%~dp0"
echo Servint Cambra a http://localhost:8731 ...
start "" "http://localhost:8731/index.html"
python serve.py 8731
