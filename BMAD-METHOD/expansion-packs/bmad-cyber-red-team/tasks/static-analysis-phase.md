<!-- Powered by BMAD(R) Core -->

# Task: static-analysis-phase

## Purpose
- **Perform comprehensive static analysis** on provided program files/directories to identify security vulnerabilities and code quality issues.
- Produce `docs/red-team/static-analysis-report.md` with **detailed findings**, severity ratings, and remediation guidance.

## Prerequisites
- Program location (file path or directory) to analyze
- Access to cross-platform static analysis tools (Linux and Windows)
- Directories: `reports/static-analysis/`, `build/static-analysis/`

## Success Criteria
- **Comprehensive vulnerability scan** completed using multiple SAST tools
- **Detailed findings report** with severity ratings (Critical, High, Medium, Low)
- **MITRE ATT&CK technique mapping** for relevant findings
- **Artefact paths, logs, and hashes** stored in `reports/static-analysis/`
- Clear **remediation guidance** for each identified issue

## Safety & Compliance
- **Only analyze files explicitly provided by the user**
- **Never execute potentially harmful code during analysis**
- Default to **passive scanning methods** without runtime execution
- **Log every command, output, and artefact** with UTC timestamps and hashes

## Recommended Tooling

### Linux/Kali Tools
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| bandit | `bandit -r {{program_location}} -f json -o reports/static-analysis/bandit-{{timestamp}}.json` | **Scan** Python code for common security issues. | JSON report with vulnerabilities, line numbers, and severity ratings. |
| flawfinder | `flawfinder --dataonly --quiet {{program_location}} > reports/static-analysis/flawfinder-{{timestamp}}.txt` | **Analyze** C/C++ code for potential security flaws. | List of potential security flaws with risk ratings and line references. |
| brakeman | `brakeman -o reports/static-analysis/brakeman-{{timestamp}}.html {{program_location}}` | **Review** Ruby/Rails applications for vulnerabilities. | HTML report highlighting security issues with context and recommendations. |
| semgrep | `semgrep --config=../.semgrep-rules/ --json -o reports/static-analysis/semgrep-{{timestamp}}.json {{program_location}}` | **Perform** pattern-based security scanning across multiple languages. | JSON output with findings, severity, and code locations. |
| checkov | `checkov -d {{program_location}} -o json > reports/static-analysis/checkov-{{timestamp}}.json` | **Scan** infrastructure as code (Terraform, CloudFormation, etc.) for misconfigurations. | JSON report with security and compliance findings. |
| golangci-lint | `golangci-lint run --out-format=checkstyle > reports/static-analysis/golangci-{{timestamp}}.xml {{program_location}}` | **Analyze** Go code for security and quality issues. | XML report with detailed findings and source locations. |
| find-sec-bugs | `java -jar /opt/findsecbugs/findsecbugs-cli.jar -html -output reports/static-analysis/findsecbugs-{{timestamp}}.html -project "Static Analysis" {{program_location}}` | **Scan** Java applications for security vulnerabilities. | HTML report highlighting security flaws with OWASP references. |
| phpcs-sf | `phpcs --standard=SecurityAnalysis --report=full -p {{program_location}} > reports/static-analysis/phpcs-{{timestamp}}.txt` | **Review** PHP code for security vulnerabilities. | Detailed text report with vulnerabilities and line numbers. |

### Windows Tools
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| semgrep | `semgrep --config=../.semgrep-rules/ --json -o reports/static-analysis/semgrep-{{timestamp}}.json {{program_location}}` | **Perform** pattern-based security scanning across multiple languages. | JSON output with findings, severity, and code locations. |
| strings (Sysinternals) | `strings.exe {{program_location}} > reports/static-analysis/strings-{{timestamp}}.txt` | **Extract** readable strings from binary files. | Text file containing all readable strings found in binary. |
| pestudio | `pestudio.exe {{program_location}}` | **Analyze** PE files for potential security issues. | Comprehensive analysis report of PE structure. |
| Dependency Walker | `depends.exe {{program_location}}` | **Analyze** imported functions in PE files. | List of imported functions and dependencies. |
| PE-bear | `PE-bear.exe {{program_location}}` | **Analyze** PE file structure. | Detailed PE structure analysis. |
| checkov | `checkov -d {{program_location}} -o json > reports/static-analysis/checkov-{{timestamp}}.json` | **Scan** infrastructure as code for misconfigurations. | JSON report with security and compliance findings. |
| bandit | `bandit -r {{program_location}} -f json -o reports/static-analysis/bandit-{{timestamp}}.json` | **Scan** Python code for common security issues. | JSON report with vulnerabilities, line numbers, and severity ratings. |

### Cross-Platform Tools (via Python/npm)
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| semgrep | `semgrep --config=../.semgrep-rules/ --json -o reports/static-analysis/semgrep-{{timestamp}}.json {{program_location}}` | **Perform** pattern-based security scanning across multiple languages. | JSON output with findings, severity, and code locations. |
| checkov | `checkov -d {{program_location}} -o json > reports/static-analysis/checkov-{{timestamp}}.json` | **Scan** infrastructure as code for misconfigurations. | JSON report with security and compliance findings. |
| bandit | `bandit -r {{program_location}} -f json -o reports/static-analysis/bandit-{{timestamp}}.json` | **Scan** Python code for common security issues. | JSON report with vulnerabilities, line numbers, and severity ratings. |
| NodeJsScan | `nodejsscan {{program_location}} -o reports/static-analysis/nodejsscan-{{timestamp}}.html` | **Scan** Node.js applications for security issues. | HTML report with security findings. |

> ⚠️ **All tools require explicit user confirmation before execution.**
> **OS Detection**: The agent will automatically detect the operating system and recommend appropriate tools.
> **Tool Availability**: If a specific tool is not available, the agent will suggest installation or alternative tools.

## Procedure
1. **Detect Operating System**: Identify whether running on Linux/Kali or Windows.
2. **Confirm program location** to analyze and scope of analysis with the user.
3. **Determine file type** (source code, binary, etc.) to select appropriate tools.
4. **Select appropriate static analysis tools** based on:
   - Operating system (Linux/Kali vs Windows)
   - Target program's language/technology stack
   - File format (source vs binary)
   - Available tools on the system
5. For each selected tool:
   - **Prompt user**: "Run [tool] on [{{program_location}}]? (y/N)"
   - **If confirmed**, execute command, capture full output, store in `reports/static-analysis/{{tool}}-{{timestamp}}.log`
6. **Validate analysis completion**:
   - Check that each tool ran to completion without errors
   - Verify output files were created successfully
   - Review initial findings for completeness
7. **Analyze results**:
   - Aggregate findings from all tools
   - Cross-reference results to eliminate duplicates
   - Assign severity ratings (Critical, High, Medium, Low) to each finding
   - Map relevant findings to MITRE ATT&CK techniques
8. **Document each vulnerability** including:
   - **Vulnerability Type** (e.g., SQL Injection, XSS, Buffer Overflow)
   - **Severity Rating** (Critical, High, Medium, Low)
   - **Location** (file and line number)
   - **Description** of the security risk
   - **MITRE ATT&CK mapping** where applicable
   - **Recommended Remediation** steps
9. **Generate comprehensive report** in `docs/red-team/static-analysis-report.md` via template with:
   - **Summary of findings**
   - **Detailed vulnerability list** with severity ratings
   - **Remediation guidance**
   - **MITRE ATT&CK mappings**
10. Store raw analysis outputs in `reports/static-analysis/` with proper naming conventions.
11. Prepare recommendations brief:
   > "Static analysis completed on {{program_location}}.  
   > {{total_vulnerabilities}} vulnerabilities identified: {{by_severity}}.  
   > Priority fixes: {{top_critical_issues}}."
   > **OS Platform**: {{operating_system}}
   > **Tools Used**: {{tools_used}}

## Decision Gates
- **User Confirmation**: **Never auto-execute** — require "y" per tool.
- **File Access**: If target location is inaccessible, log error and request alternative path.
- **Tool Availability**: If SAST tool is not installed, suggest alternative or skip to next tool.
- **Analysis Scope**: If program is very large, confirm extended analysis time with user.

## Outputs
- `docs/red-team/static-analysis-report.md` (comprehensive vulnerability report)
- Tool-specific output files in `reports/static-analysis/`