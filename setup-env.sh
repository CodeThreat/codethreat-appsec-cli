#!/bin/bash

# CodeThreat CLI Environment Setup Script
# Source this file to set up environment variables for CLI usage

echo "🔧 Setting up CodeThreat CLI environment..."

# Load from .env file if it exists
if [ -f ".env" ]; then
    echo "📁 Loading environment from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Set API key if not already set
if [ -z "$CT_API_KEY" ]; then
    echo "⚠️  CT_API_KEY not set. Please set it manually:"
    echo "   export CT_API_KEY='your_api_key_here'"
else
    echo "✅ CT_API_KEY is set"
fi

# Display current configuration
echo ""
echo "🎯 Current CLI Configuration:"
echo "   Server URL: ${CT_SERVER_URL:-https://app.codethreat.com}"
echo "   API Key: ${CT_API_KEY:+Set}${CT_API_KEY:-Not set}"
echo "   Organization: ${CT_ORG_ID:-Not set}"
echo "   Verbose: ${CT_VERBOSE:-false}"

echo ""
echo "🚀 CLI is ready! Try: codethreat --help"
echo ""
echo "💡 To use in new terminals:"
echo "   source setup-env.sh"
echo "   # or"
echo "   export CT_API_KEY='your_key' && export CT_SERVER_URL='http://localhost:3000'"
