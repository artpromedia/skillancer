# Security Incident Runbook

This runbook provides procedures for responding to security incidents affecting Skillancer.

## Incident Classification

### Critical Severity

- **Definition**: Active data breach, unauthorized access to PII, system compromise
- **Response Time**: Immediate (within 5 minutes)
- **Examples**:
  - Confirmed data exfiltration
  - Unauthorized access to production database
  - Ransomware or malware infection
  - Compromised admin credentials

### High Severity

- **Definition**: Potential vulnerability exploitation, suspicious access patterns
- **Response Time**: Within 30 minutes
- **Examples**:
  - Successful SQL injection attempt
  - Brute force attack succeeding
  - Unusual admin activity
  - Third-party integration breach

### Medium Severity

- **Definition**: Failed attack attempts, policy violations detected
- **Response Time**: Within 2 hours
- **Examples**:
  - Multiple failed login attempts
  - Blocked vulnerability scans
  - Suspicious API usage patterns
  - Minor policy violations

### Low Severity

- **Definition**: Configuration issues, minor policy violations
- **Response Time**: Within 24 hours
- **Examples**:
  - Expired certificates (with backup)
  - Security header misconfiguration
  - Non-critical patches available
  - Policy audit findings

---

## Immediate Actions

### 1. Contain the Incident

**Isolate Affected Systems:**

```bash
# Block suspicious IP
aws waf update-ip-set \
  --name blocked-ips \
  --scope REGIONAL \
  --id $IP_SET_ID \
  --addresses "x.x.x.x/32"

# Disable compromised user account
psql -c "UPDATE users SET status = 'suspended', suspended_at = now(), suspended_reason = 'security_incident' WHERE id = 'user_id';"

# Revoke all sessions for user
redis-cli KEYS "session:user_id:*" | xargs redis-cli DEL

# Isolate affected service
kubectl scale deployment affected-service --replicas=0 -n production
```

**Network Isolation (Severe Cases):**

```bash
# Enable emergency security group
aws ec2 modify-instance-attribute \
  --instance-id $INSTANCE_ID \
  --groups $EMERGENCY_SG_ID

# Block all traffic except security team
aws ec2 authorize-security-group-ingress \
  --group-id $EMERGENCY_SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr $SECURITY_TEAM_IP/32
```

### 2. Preserve Evidence

**Capture Logs:**

```bash
# Export CloudWatch logs
aws logs create-export-task \
  --task-name "security-incident-$(date +%Y%m%d%H%M)" \
  --log-group-name "/aws/eks/production/api-gateway" \
  --from $(date -d '24 hours ago' +%s)000 \
  --to $(date +%s)000 \
  --destination "security-incidents-bucket"

# Snapshot affected database
aws rds create-db-snapshot \
  --db-instance-identifier skillancer-production \
  --db-snapshot-identifier "security-incident-$(date +%Y%m%d%H%M)"

# Capture pod logs
kubectl logs deployment/affected-service -n production --all-containers > incident-logs.txt
```

**Capture System State:**

```bash
# EKS node state
kubectl describe nodes > node-state.txt

# Running processes
kubectl exec -it $POD_NAME -- ps aux > process-list.txt

# Network connections
kubectl exec -it $POD_NAME -- netstat -tulpn > network-connections.txt
```

### 3. Notify Security Team

**Immediate Notification:**

```
🚨 SECURITY INCIDENT DECLARED

Severity: [Critical/High/Medium/Low]
Type: [Data Breach / Unauthorized Access / Vulnerability / etc.]
Time Detected: [UTC timestamp]
Detected By: [Automated/Manual]

Initial Assessment:
[Brief description of what was detected]

Affected Systems:
- [List of affected systems]

Immediate Actions Taken:
- [Actions already performed]

Incident Lead: @security-lead
War Room: #security-incident-YYYYMMDD
```

---

## Communication Protocol

### Internal Communication

| Severity | Notify                    | Channel      | Timeframe   |
| -------- | ------------------------- | ------------ | ----------- |
| Critical | CTO, Security Lead, Legal | Call + Slack | Immediately |
| High     | Security Lead, Eng Lead   | Slack        | 30 minutes  |
| Medium   | Security Team             | Slack        | 2 hours     |
| Low      | Security Team             | Email        | 24 hours    |

### Executive Notification

**For Critical incidents, email to CTO within 1 hour:**

```
Subject: SECURITY INCIDENT - [Brief Description]

Severity: Critical
Status: Active investigation

Summary:
[2-3 sentence description]

Current Impact:
- Users affected: [estimated number]
- Data at risk: [type of data]
- Systems affected: [list]

Actions Being Taken:
1. [Current containment actions]
2. [Investigation steps]
3. [Next steps]

Timeline:
- [Time]: Incident detected
- [Time]: Containment initiated
- [Time]: Investigation started

Next Update: [Time]

Incident Lead: [Name]
```

### Legal Notification

**Notify legal counsel if:**

- PII potentially accessed
- Financial data potentially exposed
- Regulatory reporting may be required
- Customer notification may be needed

### Customer Communication

**Do NOT communicate externally until:**

1. Legal counsel has reviewed
2. Scope is understood
3. Approved communication template is ready

---

## Investigation Procedures

### Data Breach Investigation

#### 1. Determine Scope

```sql
-- Check for unauthorized data access
SELECT
  user_id,
  action,
  resource,
  ip_address,
  timestamp
FROM audit_logs
WHERE timestamp BETWEEN '[start_time]' AND '[end_time]'
AND (
  action LIKE '%export%' OR
  action LIKE '%download%' OR
  resource LIKE '%users%' OR
  resource LIKE '%contracts%'
)
ORDER BY timestamp;
```

#### 2. Identify Affected Users

```sql
-- Find potentially affected users
SELECT DISTINCT
  u.id,
  u.email,
  u.created_at,
  u.last_login
FROM users u
JOIN audit_logs a ON a.resource LIKE '%users/' || u.id || '%'
WHERE a.timestamp BETWEEN '[start_time]' AND '[end_time]'
AND a.user_id = '[suspicious_user_id]';
```

#### 3. Check Data Exfiltration

```bash
# Check for large data transfers
aws cloudwatch logs filter-log-events \
  --log-group-name "/aws/eks/production/api-gateway" \
  --filter-pattern "{ $.response_size > 1000000 }" \
  --start-time $(date -d '24 hours ago' +%s)000

# Check S3 access logs
aws s3api get-bucket-logging --bucket skillancer-production
```

### Unauthorized Access Investigation

#### 1. Review Access Logs

```bash
# Check authentication logs
aws cloudwatch logs filter-log-events \
  --log-group-name "/aws/eks/production/auth-svc" \
  --filter-pattern "{ $.event = 'login_success' && $.ip = '[suspicious_ip]' }"

# Check admin access
grep -r "admin" /var/log/auth/*.log | grep "[suspicious_ip]"
```

#### 2. Verify Credential Compromise

```sql
-- Check password changes
SELECT
  user_id,
  action,
  timestamp,
  ip_address
FROM audit_logs
WHERE action = 'password_changed'
AND timestamp > now() - interval '7 days'
ORDER BY timestamp DESC;

-- Check API key creation
SELECT * FROM api_keys
WHERE created_at > now() - interval '7 days';
```

#### 3. Review Session Activity

```bash
# List active sessions for user
redis-cli KEYS "session:user:$USER_ID:*"

# Get session details
redis-cli HGETALL "session:$SESSION_ID"
```

---

## Post-Incident Procedures

### Forensic Analysis

1. **Create forensic image** of affected systems
2. **Chain of custody** documentation
3. **Third-party forensics** if needed (Critical incidents)

### Remediation

```bash
# Force password reset for affected users
psql -c "UPDATE users SET force_password_reset = true WHERE id IN (SELECT user_id FROM affected_users);"

# Rotate all secrets
./scripts/rotate-secrets.sh --all

# Update WAF rules
aws waf update-web-acl --name production-acl --rules file://updated-rules.json

# Patch vulnerability (if applicable)
kubectl set image deployment/affected-service app=fixed-image:v1.2.3
```

### Customer Notification

**If required by legal/compliance:**

```
Subject: Important Security Notice from Skillancer

Dear [Customer Name],

We are writing to inform you of a security incident that may have
affected your account.

What Happened:
[Clear, factual description]

What Information Was Involved:
[Specific data types]

What We Are Doing:
[Remediation steps]

What You Can Do:
1. Change your password at [link]
2. Review your account activity
3. Enable two-factor authentication
4. [Other recommendations]

For More Information:
Contact our security team at security@skillancer.com

We sincerely apologize for any concern this may cause.

The Skillancer Security Team
```

### Regulatory Reporting

| Regulation | Requirement                           | Timeframe                  |
| ---------- | ------------------------------------- | -------------------------- |
| GDPR       | Notify supervisory authority          | 72 hours                   |
| CCPA       | Notify affected California residents  | Without unreasonable delay |
| PCI-DSS    | Report to card brands (if applicable) | Immediately                |

---

## Security Tools & Commands

### Threat Detection

```bash
# Check for malware signatures
clamscan -r /var/app/

# Review failed authentication attempts
aws cloudwatch logs filter-log-events \
  --log-group-name "/aws/eks/production/auth-svc" \
  --filter-pattern "{ $.event = 'login_failed' }"

# Check for unusual API patterns
./scripts/analyze-api-traffic.sh --last-24h
```

### Vulnerability Assessment

```bash
# Run security scan
trivy image skillancer/api-gateway:latest

# Check for known vulnerabilities
npm audit --production

# OWASP ZAP scan
zap-cli quick-scan --self-contained https://skillancer.com
```

### Access Control

```bash
# List all IAM access keys
aws iam list-access-keys --user-name $USER

# Disable access key
aws iam update-access-key \
  --access-key-id $KEY_ID \
  --status Inactive \
  --user-name $USER

# Revoke OAuth tokens
psql -c "DELETE FROM oauth_tokens WHERE user_id = '$USER_ID';"
```

---

## Security Contacts

### Internal

| Role          | Contact                              |
| ------------- | ------------------------------------ |
| Security Lead | @security-lead (Slack)               |
| CTO           | @cto (Slack), cto@skillancer.com     |
| Legal         | @legal (Slack), legal@skillancer.com |
| DPO           | dpo@skillancer.com                   |

### External

| Service                | Contact                     |
| ---------------------- | --------------------------- |
| AWS Security           | AWS Support Case (Priority) |
| Incident Response Firm | [Contracted IR firm]        |
| Law Enforcement        | Local FBI field office (US) |
| Bug Bounty             | security@skillancer.com     |

---

## Post-Mortem Template

```markdown
# Security Incident Post-Mortem

## Incident Summary

- **Date**:
- **Duration**:
- **Severity**:
- **Type**:
- **Lead**:

## Impact

- Users affected:
- Data exposed:
- Financial impact:
- Regulatory impact:

## Timeline

| Time (UTC) | Event |
| ---------- | ----- |
|            |       |

## Root Cause

[Detailed explanation]

## Attack Vector

[How the attacker gained access]

## Detection

[How the incident was detected]

## Response Actions

1.
2.
3.

## What Worked Well

-

## What Could Be Improved

-

## Action Items

| Action | Owner | Due Date | Status |
| ------ | ----- | -------- | ------ |
|        |       |          |        |

## Lessons Learned
```
