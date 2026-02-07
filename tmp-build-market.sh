#!/bin/bash
set -e
cd /opt/skillancer

echo "========================================="
echo "Building: web-market"
echo "========================================="
if docker build -t "skillancer/web-market:latest" -f "apps/web-market/Dockerfile" . > "/tmp/build-web-market.log" 2>&1; then
  echo "OK: web-market"
else
  echo "FAIL: web-market"
  tail -50 "/tmp/build-web-market.log"
fi

echo ""
docker images | grep skillancer
