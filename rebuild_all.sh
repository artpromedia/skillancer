#!/bin/bash
set -e
cd /opt/skillancer

# List of all services/apps to rebuild
BACKEND_SERVICES="market-svc billing-svc cockpit-svc notification-svc skillpod-svc"
FRONTEND_APPS="admin web-cockpit web-skillpod"

echo "========================================="
echo " Rebuilding all down services"
echo "========================================="
echo ""

# Build backend services
for SVC in $BACKEND_SERVICES; do
  echo ">>> Building $SVC..."
  docker build --no-cache -f services/$SVC/Dockerfile -t skillancer/$SVC:latest . 2>&1 | tail -3
  echo ">>> Importing $SVC into K3s..."
  docker save skillancer/$SVC:latest | k3s ctr images import -
  echo ">>> $SVC done!"
  echo ""
done

# Build frontend apps
for APP in $FRONTEND_APPS; do
  echo ">>> Building $APP..."
  docker build --no-cache -f apps/$APP/Dockerfile -t skillancer/$APP:latest . 2>&1 | tail -3
  echo ">>> Importing $APP into K3s..."
  docker save skillancer/$APP:latest | k3s ctr images import -
  echo ">>> $APP done!"
  echo ""
done

echo "========================================="
echo " All images rebuilt and imported!"
echo "========================================="
echo ""

# Restart all pods for the rebuilt services
echo ">>> Restarting all affected pods..."
for SVC in $BACKEND_SERVICES; do
  kubectl -n skillancer delete pods -l app=$SVC --force --grace-period=0 2>/dev/null || true
done
for APP in $FRONTEND_APPS; do
  kubectl -n skillancer delete pods -l app=$APP --force --grace-period=0 2>/dev/null || true
done

echo ""
echo ">>> Waiting 30s for pods to restart..."
sleep 30

echo ""
echo ">>> Final pod status:"
kubectl -n skillancer get pods
