#!/usr/bin/env fish

# CodeThreat CLI Environment Setup Script for Fish Shell
# Source this file to set up environment variables for CLI usage

echo "🔧 Setting up CodeThreat CLI environment..."

# Load from .env file if it exists
if test -f ".env"
    echo "📁 Loading environment from .env file..."
    for line in (cat .env | grep -v '^#' | grep -v '^$')
        set -l key_value (string split '=' $line)
        if test (count $key_value) -ge 2
            set -gx $key_value[1] (string join '=' $key_value[2..-1])
        end
    end
end

# Set API key if not already set
if test -z "$CT_API_KEY"
    echo "⚠️  CT_API_KEY not set. Please set it manually:"
    echo "   set -gx CT_API_KEY 'your_api_key_here'"
else
    echo "✅ CT_API_KEY is set"
end

# Display current configuration
echo ""
echo "🎯 Current CLI Configuration:"
echo "   Server URL: "(set -q CT_SERVER_URL; and echo $CT_SERVER_URL; or echo "https://api.codethreat.com")
echo "   API Key: "(test -n "$CT_API_KEY"; and echo "Set"; or echo "Not set")
echo "   Organization: "(set -q CT_ORG_ID; and echo $CT_ORG_ID; or echo "Not set")
echo "   Verbose: "(set -q CT_VERBOSE; and echo $CT_VERBOSE; or echo "false")

echo ""
echo "🚀 CLI is ready! Try: codethreat --help"
echo ""
echo "💡 To use in new terminals:"
echo "   source setup-env.fish"
echo "   # or"
echo "   set -gx CT_API_KEY 'your_key'; set -gx CT_SERVER_URL 'http://localhost:3000'"
