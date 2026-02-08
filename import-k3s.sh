#!/bin/bash
LOG=/tmp/import-k3s.log
echo "=== K3S IMPORT START $(date) ===" > $LOG

IMAGES=(
  skillancer/api-gateway:latest
  skillancer/auth-svc:latest
  skillancer/billing-svc:latest
  skillancer/cockpit-svc:latest
  skillancer/market-svc:latest
  skillancer/notification-svc:latest
  skillancer/skillpod-svc:latest
  skillancer/audit-svc:latest
  skillancer/web-market:latest
  skillancer/web-cockpit:latest
  skillancer/web-skillpod:latest
  skillancer/admin:latest
)

for img in "${IMAGES[@]}"; do
  name=$(echo $img | cut -d: -f1 | cut -d/ -f2)
  echo "Importing $name ..." | tee -a $LOG
  docker save $img | k3s ctr images import - 2>&1 | tee -a $LOG
  echo "OK $name" | tee -a $LOG
done

echo "" | tee -a $LOG
echo "=== IMPORT DONE $(date) ===" | tee -a $LOG

echo "" | tee -a $LOG
echo "Restarting deployments..." | tee -a $LOG
kubectl -n skillancer rollout restart deployment 2>&1 | tee -a $LOG

echo "" | tee -a $LOG
echo "Scaling audit-svc to 0..." | tee -a $LOG
kubectl -n skillancer scale deployment audit-svc --replicas=0 2>&1 | tee -a $LOG

echo "" | tee -a $LOG
echo "Applying updated manifests..." | tee -a $LOG
kubectl apply -f /opt/skillancer/infrastructure/kubernetes/production/manifests/11-web-cockpit.yaml 2>&1 | tee -a $LOG
kubectl apply -f /opt/skillancer/infrastructure/kubernetes/production/manifests/13-admin.yaml 2>&1 | tee -a $LOG

echo "" | tee -a $LOG
echo "Waiting 30s for pods to start..." | tee -a $LOG
sleep 30

echo "" | tee -a $LOG
kubectl -n skillancer get pods -o wide 2>&1 | tee -a $LOG
echo "" | tee -a $LOG
echo "=== ALL DONE $(date) ===" | tee -a $LOG
