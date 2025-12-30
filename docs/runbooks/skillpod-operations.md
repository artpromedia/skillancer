# SkillPod Operations Runbook

This runbook covers operational procedures for the SkillPod VDI service.

## Overview

SkillPod provides secure, containerized development environments for:

- Skill verification assessments
- Secure client project work
- Compliance-required work sessions

**Architecture:**

- Kasm Workspaces backend
- Kubernetes-based pod provisioning
- S3-based recording storage
- Redis-based session management

---

## Pod Provisioning Issues

### Symptoms

- Users unable to start sessions
- "Pod provisioning failed" errors
- Long wait times (> 60 seconds)

### Diagnosis

```bash
# Check SkillPod service health
kubectl get pods -l app=skillpod-svc -n production

# Check recent provisioning attempts
kubectl logs -l app=skillpod-svc -n production --tail=100 | grep -i "provision"

# Check Kasm API connectivity
curl -s https://kasm.skillancer.internal/api/public/get_server_status \
  -H "Authorization: Bearer $KASM_API_KEY" | jq .
```

### Common Issues

#### 1. Kasm API Connectivity

```bash
# Test connectivity
kubectl exec -it deployment/skillpod-svc -n production -- \
  curl -v https://kasm.skillancer.internal/api/public/health

# Check DNS resolution
kubectl exec -it deployment/skillpod-svc -n production -- \
  nslookup kasm.skillancer.internal

# Fix: Restart CoreDNS if DNS issues
kubectl rollout restart deployment/coredns -n kube-system
```

#### 2. Resource Quotas Exceeded

```bash
# Check current resource usage
kubectl describe resourcequota -n skillpod-pods

# Check pending pods
kubectl get pods -n skillpod-pods --field-selector=status.phase=Pending

# Fix: Increase quota or clean up idle pods
kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: skillpod-quota
  namespace: skillpod-pods
spec:
  hard:
    pods: "100"
    requests.cpu: "200"
    requests.memory: "400Gi"
EOF
```

#### 3. Image Pull Issues

```bash
# Check image availability
kubectl describe pod $PENDING_POD -n skillpod-pods | grep -A5 "Events"

# Check image registry
aws ecr describe-images \
  --repository-name skillancer/skillpod-base \
  --query 'imageDetails[0].imageTags'

# Fix: Update image pull secrets
kubectl create secret docker-registry ecr-secret \
  -n skillpod-pods \
  --docker-server=$ECR_REGISTRY \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password)
```

#### 4. Node Capacity

```bash
# Check node resources
kubectl top nodes

# Check for node pressure
kubectl describe nodes | grep -A5 "Conditions:"

# Fix: Scale node group
eksctl scale nodegroup \
  --cluster skillancer \
  --name skillpod-nodes \
  --nodes 10
```

### Provisioning Logs

```bash
# Stream provisioning logs
kubectl logs -f deployment/skillpod-svc -n production | grep -E "(provision|session|error)"

# Check Kasm provisioning
ssh kasm-server "tail -f /var/log/kasm/provisioning.log"
```

---

## Session Termination

### Normal Termination

Users can end sessions through the UI. Sessions auto-terminate after:

- Idle timeout: 30 minutes
- Maximum duration: 8 hours

### Emergency Kill Switch

**For immediate termination of all sessions:**

```bash
# Emergency: Kill all active sessions
./scripts/skillpod-emergency-kill.sh --confirm

# Or via API
curl -X POST https://api.skillancer.com/internal/skillpod/emergency-stop \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Emergency-Reason: security-incident"
```

**For specific session:**

```bash
# Terminate single session
curl -X DELETE https://api.skillancer.com/internal/skillpod/sessions/$SESSION_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Termination-Reason: admin-request"
```

### Bulk Termination

**By user:**

```bash
# Terminate all sessions for user
psql -c "UPDATE skillpod_sessions SET status = 'terminated', terminated_at = now(), terminated_reason = 'admin' WHERE user_id = '$USER_ID' AND status = 'active';"

# Clean up pods
kubectl delete pods -l user=$USER_ID -n skillpod-pods
```

**By contract:**

```bash
# Terminate all sessions for contract
curl -X POST https://api.skillancer.com/internal/skillpod/contracts/$CONTRACT_ID/terminate-sessions \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Data Preservation During Termination

```bash
# Graceful termination with data save (default)
./scripts/skillpod-terminate.sh $SESSION_ID --save-data

# Immediate termination (data may be lost)
./scripts/skillpod-terminate.sh $SESSION_ID --force --no-save
```

---

## Recording Management

### Storage Architecture

| Type                 | Storage     | Retention      |
| -------------------- | ----------- | -------------- |
| Active recordings    | EBS SSD     | During session |
| Completed recordings | S3 Standard | 30 days        |
| Archived recordings  | S3 Glacier  | Per policy     |

### Storage Monitoring

```bash
# Check recording storage usage
aws s3 ls s3://skillancer-recordings --summarize --human-readable

# Check by date
aws s3 ls s3://skillancer-recordings/2024/01/ --recursive --summarize

# Disk usage on recorders
kubectl exec -it deployment/recording-svc -- df -h /recordings
```

### Retention Policy Enforcement

```bash
# Check retention status
psql -c "SELECT policy, count(*), min(created_at), max(created_at) FROM skillpod_recordings GROUP BY policy;"

# Run retention cleanup
./scripts/recording-retention-cleanup.sh --dry-run
./scripts/recording-retention-cleanup.sh --execute

# Manual archive
aws s3 mv s3://skillancer-recordings/session-$ID.webm \
  s3://skillancer-recordings-archive/session-$ID.webm
```

### Emergency Recording Retrieval

**For audit or legal purposes:**

```bash
# 1. Check if recording exists
psql -c "SELECT * FROM skillpod_recordings WHERE session_id = '$SESSION_ID';"

# 2. Restore from Glacier if archived
aws s3api restore-object \
  --bucket skillancer-recordings-archive \
  --key "session-$SESSION_ID.webm" \
  --restore-request '{"Days":7,"GlacierJobParameters":{"Tier":"Expedited"}}'

# 3. Generate signed URL for access
aws s3 presign s3://skillancer-recordings/session-$SESSION_ID.webm --expires-in 86400

# 4. Log access for audit
psql -c "INSERT INTO recording_access_log (recording_id, accessor_id, purpose, timestamp) VALUES ('$RECORDING_ID', '$ADMIN_ID', 'legal_request', now());"
```

### Recording Integrity

```bash
# Verify recording integrity
./scripts/verify-recording.sh $SESSION_ID

# Check for corrupted recordings
aws s3api head-object \
  --bucket skillancer-recordings \
  --key "session-$SESSION_ID.webm" \
  --query '[ContentLength, ETag]'
```

---

## Compliance Audit Support

### Audit Log Export

```bash
# Export session logs for date range
psql -c "\COPY (SELECT * FROM skillpod_sessions WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31') TO '/tmp/sessions-jan.csv' CSV HEADER;"

# Export policy violations
psql -c "\COPY (SELECT * FROM skillpod_policy_violations WHERE timestamp BETWEEN '2024-01-01' AND '2024-01-31') TO '/tmp/violations-jan.csv' CSV HEADER;"
```

### Recording Access for Auditors

```bash
# 1. Create auditor account with limited access
curl -X POST https://api.skillancer.com/internal/users/auditor \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "email": "auditor@firm.com",
    "role": "auditor",
    "access_scope": "recordings_readonly",
    "expires_at": "2024-02-01T00:00:00Z"
  }'

# 2. Generate recording access URLs
./scripts/generate-audit-access.sh \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --contract-id $CONTRACT_ID \
  --output audit-urls.csv
```

### Policy Configuration Export

```bash
# Export all security policies
psql -c "\COPY (SELECT * FROM skillpod_policies ORDER BY created_at) TO '/tmp/policies-export.csv' CSV HEADER;"

# Export policy history
psql -c "\COPY (SELECT * FROM skillpod_policy_history WHERE contract_id = '$CONTRACT_ID') TO '/tmp/policy-history.csv' CSV HEADER;"
```

### Compliance Reports

```bash
# Generate compliance summary
./scripts/compliance-report.sh \
  --period 2024-Q1 \
  --format pdf \
  --output compliance-Q1.pdf

# Report includes:
# - Total sessions and duration
# - Policy enforcement statistics
# - Violation summary
# - Recording status
```

---

## Monitoring & Alerts

### Key Metrics

| Metric                     | Warning | Critical |
| -------------------------- | ------- | -------- |
| Session start failure rate | > 5%    | > 10%    |
| Average provisioning time  | > 45s   | > 90s    |
| Active sessions per node   | > 20    | > 30     |
| Recording storage          | > 80%   | > 90%    |
| Policy violations/hour     | > 10    | > 50     |

### Dashboard

```
https://grafana.skillancer.com/d/skillpod-operations
```

### Alerts Configuration

```yaml
# Prometheus alert rules
groups:
  - name: skillpod
    rules:
      - alert: HighProvisioningFailures
        expr: rate(skillpod_provision_failures_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High SkillPod provisioning failure rate

      - alert: SessionCapacityNearLimit
        expr: skillpod_active_sessions / skillpod_max_sessions > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: SkillPod session capacity near limit
```

---

## Common Operations

### Check Session Status

```bash
# Get session details
curl https://api.skillancer.com/internal/skillpod/sessions/$SESSION_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# List active sessions
curl https://api.skillancer.com/internal/skillpod/sessions?status=active \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data | length'
```

### Extend Session Duration

```bash
# Extend by 2 hours
curl -X PATCH https://api.skillancer.com/internal/skillpod/sessions/$SESSION_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"extend_duration_minutes": 120}'
```

### Update Session Policy

```bash
# Apply stricter policy mid-session
curl -X PATCH https://api.skillancer.com/internal/skillpod/sessions/$SESSION_ID/policy \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"policy_id": "strict"}'
```

### View Session Recording (Live)

```bash
# Get live view URL (admin only)
curl https://api.skillancer.com/internal/skillpod/sessions/$SESSION_ID/live \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.live_url'
```

---

## Troubleshooting

### Session Stuck in "Starting"

```bash
# Check pod status
kubectl get pod -l session=$SESSION_ID -n skillpod-pods

# Check events
kubectl describe pod -l session=$SESSION_ID -n skillpod-pods

# Force recreation
kubectl delete pod -l session=$SESSION_ID -n skillpod-pods
```

### User Cannot Connect

```bash
# Check WebSocket connectivity
wscat -c wss://skillpod.skillancer.com/ws/$SESSION_ID

# Check session token validity
psql -c "SELECT * FROM skillpod_session_tokens WHERE session_id = '$SESSION_ID' AND expires_at > now();"

# Regenerate connection token
curl -X POST https://api.skillancer.com/internal/skillpod/sessions/$SESSION_ID/reconnect \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Recording Not Saved

```bash
# Check recording job status
kubectl get jobs -l session=$SESSION_ID -n skillpod-pods

# Check upload logs
kubectl logs job/recording-upload-$SESSION_ID -n skillpod-pods

# Manual upload trigger
./scripts/recording-upload.sh $SESSION_ID --force
```
