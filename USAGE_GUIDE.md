# CodeThreat CLI - Usage Guide

## 🚀 **Quick Setup**

### **Global Installation (Recommended)**
```bash
# Install CLI globally
npm install -g @codethreat/appsec-cli

# Set environment variables
export CT_API_KEY="your_api_key_here"
export CT_SERVER_URL="https://app.codethreat.com"  # Or your server URL

# Test CLI
codethreat auth validate
```

### **Fish Shell**
```bash
# Set environment variables
set -gx CT_API_KEY "your_api_key_here"
set -gx CT_SERVER_URL "https://app.codethreat.com"

# Test CLI
codethreat auth validate
```

### **Using NPX (No Installation)**
```bash
# Run directly with npx
npx @codethreat/appsec-cli auth validate

# Set environment variables first
export CT_API_KEY="your_api_key_here"
export CT_SERVER_URL="https://app.codethreat.com"
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
# 1. Create .env file in your project
echo "CT_API_KEY=your_actual_api_key" > .env
echo "CT_SERVER_URL=https://app.codethreat.com" >> .env

# 2. Load environment variables
source .env  # Bash/Zsh
# or for Fish shell
export (cat .env | grep -v '^#' | xargs -d '\n')
```

## 🔧 **Development vs Production**

### **Development Environment**
```bash
# Set development server
export CT_SERVER_URL="http://localhost:3000"
```

### **Production Environment**
```bash
# Set production server
export CT_SERVER_URL="https://app.codethreat.com"
```

### **On-Premises Environment**
```bash
# Set your on-premises server
export CT_SERVER_URL="https://codethreat.yourcompany.com"
```

## 📋 **Complete Workflow Example**

### **First Time Setup**
```bash
# 1. Install CLI globally
npm install -g @codethreat/appsec-cli

# 2. Set environment variables
export CT_API_KEY="your_api_key_here"
export CT_SERVER_URL="https://app.codethreat.com"

# 3. Validate setup
codethreat auth validate
```

### **Daily Usage**
```bash
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
  CT_SERVER_URL: "https://app.codethreat.com"
run: |
  codethreat repo import ${{ github.repositoryUrl }}
  codethreat scan run $REPO_ID --wait --format sarif

# GitLab CI/CD
variables:
  CT_API_KEY: $CODETHREAT_API_KEY
  CT_SERVER_URL: "https://app.codethreat.com"
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

# If not found, install globally
npm install -g @codethreat/appsec-cli

# Or use npx (no installation required)
npx @codethreat/appsec-cli --help
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

# Verify server URL is correct
echo $CT_SERVER_URL
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
