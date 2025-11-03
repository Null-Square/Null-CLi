@echo off
REM Windows Static Analysis Tools Installation Script
REM This script installs essential static analysis tools for the BMAD Static Analysis Agent

echo ===============================================
echo BMAD Static Analysis Tools Installation Script
echo ===============================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Error: This script must be run as administrator.
    echo Right-click on this script and select "Run as administrator".
    pause
    exit /b 1
)

echo Checking prerequisites...

REM Check for Chocolatey
choco --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Chocolatey package manager...
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    call refreshenv.cmd 2>nul
) else (
    echo Chocolatey is already installed.
)

REM Check for Python
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Python...
    choco install python -y
    call refreshenv.cmd 2>nul
) else (
    echo Python is already installed.
)

REM Install Python-based tools
echo Installing Python-based static analysis tools...
pip install bandit semgrep checkov

REM Install Sysinternals Suite
echo Installing Sysinternals Suite...
choco install sysinternals -y

REM Install Git for Windows (if needed)
git --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Git for Windows...
    choco install git -y
) else (
    echo Git for Windows is already installed.
)

REM Install Node.js (for NodeJsScan)
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Node.js...
    choco install nodejs -y
) else (
    echo Node.js is already installed.
)

REM Install NodeJsScan
npm install -g nodejsscan >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing NodeJsScan...
    npm install -g nodejsscan
) else (
    echo NodeJsScan is already installed.
)

echo.
echo ===============================================
echo Installation Complete!
echo ===============================================
echo.

echo Tools installed:
echo - Python (with pip)
echo - Bandit (Python security analysis)
echo - Semgrep (multi-language analysis)
echo - Checkov (IaC analysis) 
echo - Sysinternals Suite (Windows utilities)
echo - Git for Windows
echo - Node.js and NodeJsScan (Node.js analysis)
echo.

echo For more advanced features, consider installing:
echo - WSL2 with Kali Linux for full Linux toolset
echo - PE-bear for PE file analysis
echo - PEStudio for PE file analysis
echo.

echo The BMAD Static Analysis Agent is now configured with basic tools.
echo Check the docs at BMAD-METHOD\expansion-packs\bmad-cyber-red-team\docs\windows-static-analysis-setup.md for more information.
echo.

pause