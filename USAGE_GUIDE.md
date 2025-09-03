# CodeThreat CLI - Usage Guide

## 🚀 **Quick Setup for New Terminal**

### **Fish Shell (Your Current Shell)**
```bash
# Navigate to CLI directory
cd /Users/thyldrm/Desktop/codethreat/codethreat-appsec-cli

# Load environment variables
source setup-env.fish

# Or set manually
set -gx CT_API_KEY "your_api_key_here"
set -gx CT_SERVER_URL "http://localhost:3000"  # For development

# Test CLI
codethreat auth validate
```

### **Bash/Zsh**
```bash
# Navigate to CLI directory
cd /Users/thyldrm/Desktop/codethreat/codethreat-appsec-cli

# Load environment variables
source setup-env.sh

# Or set manually
export CT_API_KEY="your_api_key_here"
export CT_SERVER_URL="http://localhost:3000"

# Test CLI
codethreat auth validate
```

## 📁 **Configuration Methods**

### **Priority Order (Highest to Lowest)**:
1. **Command-line arguments**: `--api-key`, `--server-url`
2. **Environment variables**: `CT_API_KEY`, `CT_SERVER_URL`
3. **Project .env file**: `./.env`
4. **User .env file**: `~/.codethreat/.env`
5. **Project config file**: `./.codethreat.yml`
6. **User config file**: `~/.codethreat/config.yml`
7. **Default values**

### **Environment File Setup**
```bash
# 1. Copy example file
cp .env.example .env

# 2. Edit with your values
# CT_API_KEY=your_actual_api_key
# CT_SERVER_URL=http://localhost:3000

# 3. Load environment
source setup-env.fish  # Fish shell
# or
source setup-env.sh    # Bash/Zsh
```

## 🔧 **Development vs Production**

### **Development Environment**
```bash
# Set development server
set -gx CT_SERVER_URL "http://localhost:3000"

# Or use environment-specific variable
set -gx CT_SERVER_URL $CT_DEVELOPMENT_URL
```

### **Production Environment**
```bash
# Set production server
set -gx CT_SERVER_URL "https://api.codethreat.com"

# Or use environment-specific variable
set -gx CT_SERVER_URL $CT_PRODUCTION_URL
```

### **Staging Environment**
```bash
# Set staging server
set -gx CT_SERVER_URL $CT_STAGING_URL
```

## 📋 **Complete Workflow Example**

### **First Time Setup**
```bash
# 1. Navigate to CLI directory
cd /Users/thyldrm/Desktop/codethreat/codethreat-appsec-cli

# 2. Copy and configure .env
cp .env.example .env
# Edit .env file with your API key and server URL

# 3. Load environment
source setup-env.fish

# 4. Validate setup
codethreat auth validate
```

### **Daily Usage**
```bash
# Load environment (in new terminal)
cd /Users/thyldrm/Desktop/codethreat/codethreat-appsec-cli && source setup-env.fish

# Import repository
codethreat repo import https://github.com/user/repo.git

# Run scan
codethreat scan run <repo-id> --types sast,sca --wait

# Export results
codethreat scan results <scan-id> --format sarif
```

### **CI/CD Usage**
```bash
# GitHub Actions
env:
  CT_API_KEY: ${{ secrets.CODETHREAT_API_KEY }}
  CT_SERVER_URL: "https://api.codethreat.com"
run: |
  codethreat repo import ${{ github.repositoryUrl }}
  codethreat scan run $REPO_ID --wait --format sarif

# GitLab CI/CD
variables:
  CT_API_KEY: $CODETHREAT_API_KEY
  CT_SERVER_URL: "https://api.codethreat.com"
script:
  - codethreat scan run $REPO_ID --wait --format junit
```

## 🐟 **Fish Shell Specific Tips**

### **Persistent Environment Variables**
Add to your `~/.config/fish/config.fish`:
```fish
# CodeThreat CLI environment
set -gx CT_API_KEY "your_api_key"
set -gx CT_SERVER_URL "http://localhost:3000"
```

### **Project-Specific Setup**
Create a `setup.fish` file in your project:
```fish
#!/usr/bin/env fish
# Project-specific CodeThreat setup

set -gx CT_API_KEY "project_specific_key"
set -gx CT_SERVER_URL "http://localhost:3000"

echo "✅ CodeThreat environment loaded for this project"
```

## 🔍 **Troubleshooting**

### **"Unknown command: codethreat"**
```bash
# Check if globally installed
which codethreat

# If not found, reinstall globally
cd /Users/thyldrm/Desktop/codethreat/codethreat-appsec-cli
sudo npm link

# Or use direct execution
node /Users/thyldrm/Desktop/codethreat/codethreat-appsec-cli/dist/index.js --help
```

### **"Authentication invalid"**
```bash
# Check environment variables
echo $CT_API_KEY
echo $CT_SERVER_URL

# Check configuration
codethreat auth status

# Test API directly
curl -H "X-API-Key: $CT_API_KEY" $CT_SERVER_URL/api/v1/health
```

### **"Server not reachable"**
```bash
# Check server status
curl $CT_SERVER_URL/api/v1/health

# Check if development server is running
# In appsec directory: npm run dev
```

## 🎯 **Best Practices**

### **Security**
- Never commit `.env` files with real API keys
- Use different API keys for different environments
- Store production keys in secure CI/CD variables

### **Development**
- Use `.env.example` as template
- Keep development and production configurations separate
- Test with verbose mode for debugging: `codethreat --verbose`

### **CI/CD**
- Use environment variables instead of config files
- Set appropriate timeout values for your pipelines
- Use format-specific exports (SARIF for GitHub, JUnit for GitLab)

This guide ensures consistent CLI usage across different environments and team members.
