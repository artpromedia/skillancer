#!/bin/bash
# =============================================================================
# Build all Docker images for Skillancer platform
# Run from /opt/skillancer (project root)
# =============================================================================
set -e

cd /opt/skillancer

# Fix prepare script if needed
if grep -q '"prepare": "husky"' package.json; then
  sed -i 's/"prepare": "husky"/"prepare": "echo skip"/' package.json
  echo "✅ Fixed husky prepare script"
fi

echo "============================================"
echo "Building Skillancer Docker Images"
echo "============================================"

# Backend services (workspace-aware Dockerfiles)
BACKEND_SERVICES=(
  "api-gateway"
  "auth-svc"
  "market-svc"
  "skillpod-svc"
  "cockpit-svc"
  "billing-svc"
  "notification-svc"
  "audit-svc"
)

for svc in "${BACKEND_SERVICES[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔨 Building: skillancer/$svc"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  docker build -t "skillancer/$svc:latest" -f "services/$svc/Dockerfile" . 2>&1 | tail -5
  echo "✅ skillancer/$svc:latest built"
done

# Frontend apps (standalone Next.js Dockerfiles)
FRONTEND_APPS=(
  "web-market"
  "web-cockpit"
  "web-skillpod"
  "admin"
)

for app in "${FRONTEND_APPS[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔨 Building: skillancer/$app"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  docker build -t "skillancer/$app:latest" -f "apps/$app/Dockerfile" . 2>&1 | tail -5
  echo "✅ skillancer/$app:latest built"
done

# Python ML service (built with its own directory as context)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Building: skillancer/ml-recommendation-svc (Python)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker build -t "skillancer/ml-recommendation-svc:latest" services/ml-recommendation-svc/ 2>&1 | tail -5
echo "✅ skillancer/ml-recommendation-svc:latest built"

echo ""
echo "============================================"
echo "✅ All images built!"
echo "============================================"
docker images | grep skillancer
