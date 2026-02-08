#!/bin/bash
cd /opt/skillancer

LOG=/tmp/build-all.log
echo "=== BUILD START $(date) ===" > $LOG

SERVICES=(api-gateway auth-svc billing-svc cockpit-svc market-svc notification-svc skillpod-svc audit-svc)
APPS=(web-market web-cockpit web-skillpod admin)

for svc in "${SERVICES[@]}"; do
  echo "" | tee -a $LOG
  echo ">>> Building $svc $(date +%H:%M:%S)" | tee -a $LOG
  docker build --no-cache -t skillancer/$svc:latest -f services/$svc/Dockerfile . >> /tmp/build-$svc.log 2>&1
  rc=$?
  if [ $rc -eq 0 ]; then
    echo "OK $svc $(date +%H:%M:%S)" | tee -a $LOG
  else
    echo "FAIL $svc exit=$rc $(date +%H:%M:%S)" | tee -a $LOG
    tail -20 /tmp/build-$svc.log >> $LOG
  fi
done

for app in "${APPS[@]}"; do
  echo "" | tee -a $LOG
  echo ">>> Building $app $(date +%H:%M:%S)" | tee -a $LOG
  docker build --no-cache -t skillancer/$app:latest -f apps/$app/Dockerfile . >> /tmp/build-$app.log 2>&1
  rc=$?
  if [ $rc -eq 0 ]; then
    echo "OK $app $(date +%H:%M:%S)" | tee -a $LOG
  else
    echo "FAIL $app exit=$rc $(date +%H:%M:%S)" | tee -a $LOG
    tail -20 /tmp/build-$app.log >> $LOG
  fi
done

echo "" | tee -a $LOG
echo "=== ALL BUILDS DONE $(date) ===" | tee -a $LOG
docker images --filter "reference=skillancer/*" --format "{{.Repository}}:{{.Tag}} {{.Size}}" | sort | tee -a $LOG
