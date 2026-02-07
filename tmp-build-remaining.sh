#!/bin/bash
set -e
cd /opt/skillancer

APPS="web-market web-cockpit admin"

for app in $APPS; do
  echo "========================================="
  echo "Building: $app"
  echo "========================================="
  if docker build -t "skillancer/$app:latest" -f "apps/$app/Dockerfile" . > "/tmp/build-$app.log" 2>&1; then
    echo "OK: $app"
  else
    echo "FAIL: $app"
    tail -40 "/tmp/build-$app.log"
  fi
done

echo ""
echo "========================================="
echo "All frontend builds complete"
echo "========================================="
docker images | grep skillancer
