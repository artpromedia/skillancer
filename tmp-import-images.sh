#!/bin/bash
set -e

IMAGES=(
  "skillancer/api-gateway:latest"
  "skillancer/auth-svc:latest"
  "skillancer/market-svc:latest"
  "skillancer/skillpod-svc:latest"
  "skillancer/cockpit-svc:latest"
  "skillancer/billing-svc:latest"
  "skillancer/notification-svc:latest"
  "skillancer/audit-svc:latest"
  "skillancer/ml-recommendation-svc:latest"
  "skillancer/web-market:latest"
  "skillancer/web-cockpit:latest"
  "skillancer/web-skillpod:latest"
  "skillancer/admin:latest"
)

echo "Importing ${#IMAGES[@]} images into K3s containerd..."
echo ""

for img in "${IMAGES[@]}"; do
  echo -n "Importing $img ... "
  if docker save "$img" | k3s ctr images import - 2>/dev/null; then
    echo "OK"
  else
    echo "FAIL"
  fi
done

echo ""
echo "========================================="
echo "K3s images:"
echo "========================================="
k3s crictl images | grep skillancer
