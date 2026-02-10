#!/bin/bash
cd /opt/skillancer
echo "$(date) REBUILD STARTED" > /tmp/rebuild_progress.log

for SVC in cockpit-svc notification-svc skillpod-svc; do
  echo "$(date) BUILD_START: $SVC" >> /tmp/rebuild_progress.log
  docker build --no-cache -f services/$SVC/Dockerfile -t skillancer/$SVC:latest . > /tmp/build_$SVC.log 2>&1
  if [ $? -eq 0 ]; then
    docker save skillancer/$SVC:latest | k3s ctr images import -
    echo "$(date) BUILD_DONE: $SVC" >> /tmp/rebuild_progress.log
  else
    echo "$(date) BUILD_FAIL: $SVC (see /tmp/build_$SVC.log)" >> /tmp/rebuild_progress.log
  fi
done

for APP in admin web-cockpit web-skillpod; do
  echo "$(date) BUILD_START: $APP" >> /tmp/rebuild_progress.log
  docker build --no-cache -f apps/$APP/Dockerfile -t skillancer/$APP:latest . > /tmp/build_$APP.log 2>&1
  if [ $? -eq 0 ]; then
    docker save skillancer/$APP:latest | k3s ctr images import -
    echo "$(date) BUILD_DONE: $APP" >> /tmp/rebuild_progress.log
  else
    echo "$(date) BUILD_FAIL: $APP (see /tmp/build_$APP.log)" >> /tmp/rebuild_progress.log
  fi
done

echo "$(date) ALL_COMPLETE" >> /tmp/rebuild_progress.log
