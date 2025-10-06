#!/bin/bash

echo "🧪 Testing Vibeathon Proxy Integration"
echo "======================================"
echo ""

# Check environment
if [ -z "$DYAD_DISTRIBUTION_BUILD" ]; then
  echo "❌ DYAD_DISTRIBUTION_BUILD not set"
  echo "   Run: export DYAD_DISTRIBUTION_BUILD=true"
  exit 1
fi

if [ -z "$DYAD_DISTRIBUTION_PROXY_URL" ]; then
  echo "❌ DYAD_DISTRIBUTION_PROXY_URL not set"
  echo "   Run: export DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1"
  exit 1
fi

echo "✅ Environment configured:"
echo "   Distribution: $DYAD_DISTRIBUTION_BUILD"
echo "   Proxy URL: $DYAD_DISTRIBUTION_PROXY_URL"
echo ""

# Test proxy endpoint is reachable
echo "🔍 Testing proxy endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$DYAD_DISTRIBUTION_PROXY_URL/health" 2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
  echo "✅ Proxy endpoint is reachable"
elif [ "$RESPONSE" = "000" ]; then
  echo "❌ Cannot reach proxy endpoint (connection failed)"
  echo "   Make sure app.vibeathon.test Laravel backend is running"
  exit 1
else
  echo "⚠️  Proxy endpoint returned: $RESPONSE"
  echo "   This may be expected if /health endpoint doesn't exist"
fi

echo ""
echo "🚀 Starting Dyad application..."
echo "   Please test manually using the procedure in docs/vibeathon-proxy-testing.md"
echo ""

npm start
