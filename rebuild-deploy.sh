#!/bin/bash
set -e
cd /opt/skillancer

echo "$(date) REBUILD STARTED" > /tmp/rebuild_progress.log

SERVICES="api-gateway auth-svc billing-svc market-svc notification-svc cockpit-svc skillpod-svc"

for SVC in $SERVICES; do
  echo "$(date) BUILD_START: $SVC" >> /tmp/rebuild_progress.log
  docker build --no-cache -f services/$SVC/Dockerfile -t skillancer/$SVC:latest . > /tmp/build_$SVC.log 2>&1
  if [ $? -eq 0 ]; then
    docker save skillancer/$SVC:latest | k3s ctr images import -
    echo "$(date) BUILD_DONE: $SVC" >> /tmp/rebuild_progress.log
  else
    echo "$(date) BUILD_FAIL: $SVC (see /tmp/build_$SVC.log)" >> /tmp/rebuild_progress.log
  fi
done

echo "$(date) BUILD_START: web-market" >> /tmp/rebuild_progress.log
docker build --no-cache -f apps/web-market/Dockerfile -t skillancer/web-market:latest . > /tmp/build_web-market.log 2>&1
if [ $? -eq 0 ]; then
  docker save skillancer/web-market:latest | k3s ctr images import -
  echo "$(date) BUILD_DONE: web-market" >> /tmp/rebuild_progress.log
else
  echo "$(date) BUILD_FAIL: web-market (see /tmp/build_web-market.log)" >> /tmp/rebuild_progress.log
fi

echo "$(date) RESTARTING PODS" >> /tmp/rebuild_progress.log
for SVC in $SERVICES; do
  kubectl -n skillancer delete pods -l app=$SVC --force --grace-period=0 2>/dev/null || true
done
kubectl -n skillancer delete pods -l app=web-market --force --grace-period=0 2>/dev/null || true

echo "$(date) ALL_COMPLETE" >> /tmp/rebuild_progress.log
