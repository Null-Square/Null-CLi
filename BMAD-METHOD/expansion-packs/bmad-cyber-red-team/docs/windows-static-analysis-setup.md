# Windows Static Analysis Tools Setup Guide

This document provides instructions for installing static analysis tools on Windows systems to enable full functionality of the BMAD Static Analysis Agent.

## Prerequisites

Before installing the tools, ensure you have:

1. **Administrator privileges**
2. **Windows 10/11 or Windows Server 2016+**
3. **PowerShell 5.1 or later**
4. **Python 3.8+** (for Python-based tools)
5. **Git for Windows** (recommended)
6. **Chocolatey package manager** (recommended for easy installation)

## Installing Package Managers

### 1. Install Chocolatey (Recommended)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### 2. Install Python (if not already installed)
```cmd
choco install python -y
```
Or download from [python.org](https://www.python.org/downloads/)

## Installing Static Analysis Tools

### Cross-Platform Tools (via pip)

1. **Bandit** (Python security analysis)
```cmd
pip install bandit
```

2. **Semgrep** (multi-language pattern analysis)
```cmd
pip install semgrep
```

3. **Checkov** (infrastructure as code analysis)
```cmd
pip install checkov
```

4. **NodeJsScan** (Node.js security analysis)
```cmd
npm install -g nodejsscan
```

### Windows-Native Tools

1. **Sysinternals Suite** (includes Strings utility)
```cmd
choco install sysinternals -y
```
Or download from [Microsoft Sysinternals](https://docs.microsoft.com/en-us/sysinternals/)

2. **PE-bear** (PE analysis)
- Download from: [https://hshrzd.wordpress.com/pe-bear/](https://hshrzd.wordpress.com/pe-bear/)
- Extract to a directory in your PATH

3. **PEStudio** (PE file analysis)
- Download from: [https://www.winitor.com/](https://www.winitor.com/)
- Install the application

4. **Dependency Walker**
- Download from: [http://www.dependencywalker.com/](http://www.dependencywalker.com/)
- Extract and run the executable

5. **CFF Explorer** (PE editor and analyzer)
- Part of PE Explorer package
- Available as free download from various sources

## Alternative: Windows Subsystem for Linux (WSL2)

For full compatibility with Kali Linux tools, consider installing WSL2:

1. **Enable WSL2:**
```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

2. **Set WSL2 as default:**
```powershell
wsl --set-default-version 2
```

3. **Install Kali Linux from Microsoft Store:**
- Search for "Kali Linux" in Microsoft Store and install

4. **Install tools in WSL2:**
```bash
sudo apt update && sudo apt install -y bandit flawfinder brakeman semgrep checkov golangci-lint findbugs
```

## Configuration

### Environment Variables
Ensure the installation directories are added to your system PATH environment variable.

### Verification
After installation, verify tools are accessible:
```cmd
python --version
bandit --version
semgrep --version
strings.exe (if installed)
```

## Docker Alternative

For consistent environment across platforms, consider using Docker:

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    openjdk-11-jdk \
    && rm -rf /var/lib/apt/lists/*

RUN pip install bandit semgrep checkov

CMD ["bash"]
```

## Known Issues

1. **Windows Defender**: Some analysis tools may be flagged as suspicious - add them to exclusions
2. **File permissions**: Windows file permissions may affect some tools - run from user-accessible directories
3. **Path lengths**: Some tools may have issues with long file paths in Windows
4. **Case sensitivity**: Windows filesystems are case-insensitive unlike Linux

## Troubleshooting

1. **If tools are not found**: Check PATH environment variable
2. **If Python tools fail**: Check Python version and pip installation
3. **For binary analysis**: Ensure you have appropriate permissions and tools like Sysinternals are updated
4. **For best results**: Run command prompt or PowerShell as Administrator

## Additional Resources

- [OWASP Source Code Analysis Tools](https://owasp.org/www-community/Source_Code_Analysis_Tools)
- [SANS Secure Coding Tools](https://sansorg.egnyte.com/dl/2W45QX8qkA)
- [Microsoft Security Development Lifecycle Tools](https://www.microsoft.com/en-us/securityengineering/sdl/tools)