# CodeThreat CLI

Command-line interface for CodeThreat security scanning platform. Enables CI/CD integration and automated security scanning workflows.

## Installation

```bash
npm install -g @codethreat/appsec-cli
```

Or run directly with npx:
```bash
npx @codethreat/appsec-cli --help
```

## Quick Start

### 1. Environment Setup

**Option A: Using Environment Variables**
```bash
# Set environment variables (Fish shell)
set -gx CT_API_KEY "your_api_key_here"
set -gx CT_SERVER_URL "http://localhost:3000"  # For development

# Or for Bash/Zsh
export CT_API_KEY="your_api_key_here"
export CT_SERVER_URL="http://localhost:3000"
```

**Option B: Using Setup Script**
```bash
# Copy and edit .env file
cp .env.example .env
# Edit .env file with your settings

# Load environment (Fish shell)
source setup-env.fish

# Load environment (Bash/Zsh)  
source setup-env.sh
```

**Option C: Using CLI Login**
```bash
# Interactive login
codethreat auth login --api-key <your-api-key> --server-url <server-url>
```

### 2. Authentication
```bash
# Validate authentication
codethreat auth validate

# Check authentication status
codethreat auth status
```

### 2. Import Repository
```bash
# Import from Git URL
codethreat repo import https://github.com/user/repo.git

# Import with custom settings
codethreat repo import https://github.com/user/repo.git \
  --name "My Repo" \
  --types sast,sca,secrets \
  --auto-scan
```

### 3. Run Security Scan
```bash
# Asynchronous scan
codethreat scan run <repository-id> --types sast,sca

# Synchronous scan (wait for completion)
codethreat scan run <repository-id> --types sast,sca --wait --timeout 30m

# CI/CD friendly scan
codethreat scan run <repository-id> \
  --types sast,sca,secrets \
  --wait \
  --format sarif \
  --output security.sarif
```

### 4. Export Results
```bash
# Export as SARIF for GitHub Security tab
codethreat scan results <scan-id> --format sarif --output security.sarif

# Export as JUnit for GitLab CI/CD
codethreat scan results <scan-id> --format junit --output results.xml

# Export as CSV for analysis
codethreat scan results <scan-id> --format csv --severity critical,high
```

## Commands

### Authentication (`auth`)
- `auth login` - Login with API key
- `auth validate` - Validate current authentication
- `auth logout` - Clear stored credentials
- `auth status` - Show authentication status

### Repository Management (`repo`)
- `repo import <url>` - Import repository from Git URL
- `repo list` - List imported repositories
- `repo status <id>` - Get repository status and scan information

### Scanning (`scan`)
- `scan run <repo-id>` - Run security scan
- `scan status <scan-id>` - Get scan status and progress
- `scan results <scan-id>` - Export scan results
- `scan list` - List recent scans

### Organization (`org`)
- `org list` - List available organizations
- `org select <id>` - Select default organization
- `org config <id>` - Get organization configuration and limits

### Configuration (`config`)
- `config show` - Show current configuration
- `config set <key> <value>` - Set configuration value
- `config init` - Initialize configuration file

## Configuration

### Configuration File (`.codethreat.yml`)

```yaml
# Server configuration
server_url: "https://app.codethreat.com"  # Or your server URL
organization_id: "your-org-id"

# Default scan settings
default_scan_types: ["sast", "sca", "secrets"]
default_branch: "main"
default_timeout: 1800  # 30 minutes
default_poll_interval: 10  # 10 seconds

# Output settings
default_format: "json"
output_dir: "./codethreat-results"

# CI/CD behavior
fail_on_critical: true
fail_on_high: false
max_violations: 50

# CLI behavior
verbose: false
colors: true
```

### Environment Variables

**Core Configuration**:
- `CT_API_KEY` - CodeThreat API key (recommended for CI/CD)
- `CT_SERVER_URL` - CodeThreat server URL
- `CT_ORG_ID` - Default organization ID

**Server URLs for Different Environments**:
- `CT_PRODUCTION_URL` - Production server URL
- `CT_STAGING_URL` - Staging server URL  
- `CT_DEVELOPMENT_URL` - Development server URL

**Default Settings**:
- `CT_DEFAULT_SCAN_TYPES` - Default scan types (comma-separated)
- `CT_DEFAULT_BRANCH` - Default branch name
- `CT_DEFAULT_FORMAT` - Default output format
- `CT_TIMEOUT` - Default scan timeout in seconds
- `CT_POLL_INTERVAL` - Default polling interval in seconds

**CI/CD Behavior**:
- `CT_FAIL_ON_CRITICAL` - Fail build on critical findings (true/false)
- `CT_FAIL_ON_HIGH` - Fail build on high severity findings (true/false)
- `CT_MAX_VIOLATIONS` - Maximum allowed violations before failing

**CLI Behavior**:
- `CT_VERBOSE` - Enable verbose output (true/false)
- `CT_COLORS` - Enable colored output (true/false)
- `CT_OUTPUT_DIR` - Default output directory

**CLI Information** (for customization):
- `CLI_NAME` - CLI application name
- `CLI_VERSION` - CLI version
- `CLI_DESCRIPTION` - CLI description
- `SUPPORTED_FORMATS` - Supported export formats (comma-separated)
- `SUPPORTED_PROVIDERS` - Supported Git providers (comma-separated)

## CI/CD Integration

### GitHub Actions

Use the official CodeThreat GitHub Action for the best experience:

```yaml
name: Security Scan
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security:
    name: CodeThreat Security Scan
    runs-on: ubuntu-latest
    
    permissions:
      security-events: write  # Required for SARIF upload
      contents: read
      actions: read
    
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: CodeThreat Security Scan
        uses: CodeThreat/codethreat-appsec-github-action@v1
        with:
          # Required
          api-key: ${{ secrets.CODETHREAT_API_KEY }}
          server-url: ${{ secrets.CODETHREAT_SERVER_URL }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          
          # Optional - customize as needed
          scan-types: 'sast,sca,secrets'
          fail-on-critical: true
          fail-on-high: false
          timeout: 30
          
          # GitHub Security tab integration
          upload-sarif: true
          output-format: 'sarif'
```

**Alternative: Manual CLI Installation**

```yaml
name: Security Scan (Manual CLI)
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install CodeThreat CLI
        run: npm install -g @codethreat/appsec-cli
      
      - name: Run Security Scan
        env:
          CT_API_KEY: ${{ secrets.CODETHREAT_API_KEY }}
          CT_SERVER_URL: ${{ secrets.CODETHREAT_SERVER_URL }}
        run: |
          REPO_ID=$(codethreat repo import ${{ github.repositoryUrl }} --format json | jq -r '.repository.id')
          codethreat scan run $REPO_ID --wait --format sarif --output security.sarif
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: security.sarif
```

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Authentication error
- `3` - Permission error
- `4` - Scan failed with critical/high violations (based on configuration)

## Examples

### Basic Workflow
```bash
# 1. Login
codethreat auth login --api-key ct_1234567890abcdef

# 2. Import repository
codethreat repo import https://github.com/myorg/myapp.git

# 3. Run scan
codethreat scan run repo-123 --types sast,sca --wait

# 4. Export results
codethreat scan results scan-456 --format sarif
```

### CI/CD Workflow
```bash
# One-liner for CI/CD
REPO_ID=$(codethreat repo import $REPO_URL --format json | jq -r '.repository.id') && \
codethreat scan run $REPO_ID --wait --format sarif --output security.sarif
```

### Advanced Usage
```bash
# Scan with custom timeout and polling
codethreat scan run repo-123 \
  --types sast,sca,secrets \
  --wait \
  --timeout 45m \
  --poll-interval 15s \
  --format junit \
  --output results.xml

# Export filtered results
codethreat scan results scan-456 \
  --format csv \
  --severity critical,high \
  --types sast \
  --output critical-sast.csv
```

## Support

- Documentation: https://docs.codethreat.com
- Issues: https://github.com/codethreat/cli/issues
- Support: support@codethreat.com
