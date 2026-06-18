@echo off
echo Stopping Oil Stock Book Server on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Terminating process PID: %%a
    taskkill /f /pid %%a
)
echo.
echo Server stopped.
pause
