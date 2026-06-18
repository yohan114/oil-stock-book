@echo off
cd /d "%~dp0"
echo Starting Oil Stock Book Server... > startup_log.txt
npm start >> startup_log.txt 2>&1
