# Post-Implementation Steps

## ✅ What's Been Completed

All Phase 1-3 code changes have been implemented:

1. **Phase 1**: Updated `.env.example` files for Cloudflare R2 (auth-svc, skillpod-svc, cockpit-svc)
2. **Phase 2**: Implemented Hetzner Cloud Volumes API in storage.service.ts
3. **Phase 3**: Replaced AWS KMS with Node.js crypto in phi-protection.service.ts
4. **Dependencies**: Removed `@aws-sdk/client-kms` from auth-svc
5. **Documentation**: Created comprehensive setup guides
6. **Kubernetes**: Updated secrets template and deployment scripts

## 🚀 Next Steps (Action Required)

### Step 1: Obtain Required Credentials

#### 1.1 Generate Encryption Master Key

```bash
openssl rand -hex 32
```

**⚠️ CRITICAL**: Save this key securely! Losing it means losing all encrypted PHI data.

#### 1.2 Get Cloudflare R2 Credentials

1. Go to Cloudflare Dashboard → R2 → Overview
2. Click "Manage R2 API Tokens"
3. Click "Create API Token"
4. Grant permissions: Object Read & Write
5. Save the Access Key ID and Secret Access Key
6. Note your Account ID from the R2 overview page

Your R2 endpoint will be:

```
https://<account-id>.r2.cloudflarestorage.com
```

#### 1.3 Get Hetzner Cloud API Token

1. Go to Hetzner Cloud Console → Your Project
2. Navigate to Security → API Tokens
3. Click "Generate API Token"
4. Name: "skillancer-volume-management"
5. Permissions: Read & Write
6. Save the token securely

### Step 2: Update Environment Variables

#### 2.1 Local Development (.env files)

Update the following files with your credentials:

**services/auth-svc/.env**

```bash
# Cloudflare R2 (Local: Use LocalStack)
S3_ENDPOINT=http://localhost:4566
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=test
S3_SECRET_ACCESS_KEY=test
S3_BUCKET_UPLOADS=skillancer-dev-uploads
S3_BUCKET_ASSETS=skillancer-dev-assets
S3_CDN_URL=http://localhost:4566

# Encryption (Generate with: openssl rand -hex 32)
ENCRYPTION_MASTER_KEY=<your-64-hex-char-key>
ENCRYPTION_ALGORITHM=aes-256-gcm
```

**services/skillpod-svc/.env**

```bash
# Cloudflare R2 (Local: Use LocalStack)
S3_ENDPOINT=http://localhost:4566
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=test
S3_SECRET_ACCESS_KEY=test
S3_BUCKET_UPLOADS=skillancer-dev-uploads
S3_BUCKET_RECORDINGS=skillancer-dev-recordings

# Hetzner Cloud (Use test token for local dev if needed)
HETZNER_API_TOKEN=<your-hetzner-token-or-test-value>
HETZNER_LOCATION=fsn1
HETZNER_VOLUME_SIZE=10
```

**services/cockpit-svc/.env**

```bash
# Cloudflare R2 (Local: Use LocalStack)
S3_ENDPOINT=http://localhost:4566
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=test
S3_SECRET_ACCESS_KEY=test
S3_BUCKET=skillancer-dev-invoices
```

#### 2.2 Production (Kubernetes Secrets)

Update `infrastructure/kubernetes/production/manifests/01-secrets.yaml.template`:

```yaml
# Cloudflare R2 (Object Storage)
S3_ENDPOINT: 'https://<your-account-id>.r2.cloudflarestorage.com'
S3_ACCESS_KEY_ID: '<your-r2-access-key-id>'
S3_SECRET_ACCESS_KEY: '<your-r2-secret-access-key>'
S3_BUCKET_UPLOADS: 'skillancer-production-uploads'
S3_BUCKET_ASSETS: 'skillancer-production-assets'
S3_BUCKET_RECORDINGS: 'skillancer-production-recordings'

# PHI/PII Encryption (CRITICAL - Keep secure!)
ENCRYPTION_MASTER_KEY: '<your-64-hex-chars-from-openssl>'

# Hetzner Cloud API (for SkillPod volumes)
HETZNER_API_TOKEN: '<your-hetzner-api-token>'
```

Then:

1. Save the file as `01-secrets.yaml` (remove `.template`)
2. Apply to cluster: `kubectl apply -f infrastructure/kubernetes/production/manifests/01-secrets.yaml`

### Step 3: Local Testing

#### 3.1 Start Infrastructure

```bash
# Start LocalStack (S3-compatible storage)
cd infrastructure/docker
docker-compose up -d localstack postgres redis

# Verify LocalStack is running
curl http://localhost:4566/_localstack/health
```

#### 3.2 Install Dependencies

```bash
# From workspace root
pnpm install
```

#### 3.3 Run Database Migrations

```bash
pnpm db:migrate:dev
```

#### 3.4 Start Services

```bash
# Start all services
pnpm dev

# Or start specific services
pnpm dev --filter=auth-svc
pnpm dev --filter=skillpod-svc
pnpm dev --filter=cockpit-svc
```

#### 3.5 Test Endpoints

**Test Avatar Upload (R2 Integration)**

```bash
# 1. Register a test user
curl -X POST http://localhost:4001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "firstName": "Test",
    "lastName": "User"
  }'

# 2. Login to get token
TOKEN=$(curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!"
  }' | jq -r '.accessToken')

# 3. Upload avatar
curl -X POST http://localhost:4001/api/users/me/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.jpg"

# Expected: 200 OK with avatar URL
```

**Test PHI Encryption**

```bash
# This happens automatically when creating user profiles
# Check logs for encryption/decryption operations
tail -f services/auth-svc/logs/app.log | grep -i encrypt
```

**Test SkillPod Volume Creation (requires Hetzner token)**

```bash
# Create a SkillPod
curl -X POST http://localhost:4003/api/skillpods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pod",
    "image": "kasm-workspaces",
    "storage": 10
  }'

# Expected: Pod created with Hetzner volume attached
```

### Step 4: Staging Deployment

#### 4.1 Update Doppler (if using)

```bash
# Set environment variables in Doppler
doppler secrets set ENCRYPTION_MASTER_KEY "<your-key>" --project skillancer --config staging
doppler secrets set S3_ENDPOINT "https://<account-id>.r2.cloudflarestorage.com" --project skillancer --config staging
doppler secrets set S3_ACCESS_KEY_ID "<your-key>" --project skillancer --config staging
doppler secrets set S3_SECRET_ACCESS_KEY "<your-secret>" --project skillancer --config staging
doppler secrets set HETZNER_API_TOKEN "<your-token>" --project skillancer --config staging
```

#### 4.2 Deploy to Staging

```bash
# Deploy all services
./scripts/deploy-hetzner.sh staging all v1.0.0

# Or deploy specific service
./scripts/deploy-hetzner.sh staging auth-svc v1.0.0
```

#### 4.3 Verify Staging

```bash
# Check pod status
kubectl get pods -n skillancer

# Check logs
kubectl logs -n skillancer -l app=auth-svc --tail=100

# Test staging endpoints
curl https://staging.skillancer.com/api/health
```

### Step 5: Production Deployment

#### 5.1 Backup Production Database

```bash
# SSH to production server
ssh root@<production-server-ip>

# Backup database
pg_dump -U skillancer_admin -d skillancer > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup encryption keys (if migrating)
kubectl get secret skillancer-secrets -n skillancer -o yaml > secrets_backup.yaml
```

#### 5.2 Update Production Secrets

```bash
# Update the secrets file
vi infrastructure/kubernetes/production/manifests/01-secrets.yaml

# Apply updated secrets
kubectl apply -f infrastructure/kubernetes/production/manifests/01-secrets.yaml

# Verify secrets
kubectl get secret skillancer-secrets -n skillancer -o yaml
```

#### 5.3 Deploy to Production

```bash
# Deploy using the deploy script
cd infrastructure/kubernetes/production
./deploy.sh

# Or use the Hetzner deployment script
./scripts/deploy-hetzner.sh production all v1.0.0
```

#### 5.4 Monitor Deployment

```bash
# Watch rollout status
kubectl rollout status deployment/auth-svc -n skillancer
kubectl rollout status deployment/skillpod-svc -n skillancer
kubectl rollout status deployment/cockpit-svc -n skillancer

# Check pod health
kubectl get pods -n skillancer -w

# Monitor logs for errors
kubectl logs -f -n skillancer -l app=auth-svc
kubectl logs -f -n skillancer -l app=skillpod-svc
```

### Step 6: Post-Deployment Verification

#### 6.1 Health Checks

```bash
# API Gateway
curl https://api.skillancer.com/health

# Auth Service
curl https://api.skillancer.com/api/auth/health

# SkillPod Service
curl https://api.skillancer.com/api/skillpods/health
```

#### 6.2 Test Critical Flows

1. **User Registration & Avatar Upload**
   - Register new user
   - Upload avatar
   - Verify image appears (R2 working)

2. **PHI Encryption**
   - Create user profile with sensitive data
   - Check database - data should be encrypted
   - Retrieve profile - data should decrypt correctly

3. **SkillPod Creation**
   - Create new SkillPod
   - Verify Hetzner volume created
   - Verify volume attached to pod
   - Check pod status

#### 6.3 Monitor for 24-48 Hours

```bash
# Check error logs
kubectl logs -n skillancer -l app=auth-svc --since=1h | grep -i error
kubectl logs -n skillancer -l app=skillpod-svc --since=1h | grep -i error

# Check metrics (if using Prometheus)
# Look for:
# - S3 operation failures
# - Encryption/decryption errors
# - Volume creation failures
```

## 🔒 Security Checklist

- [ ] Encryption master key generated and stored securely
- [ ] Encryption master key NOT committed to git
- [ ] Cloudflare R2 credentials stored in secrets manager
- [ ] Hetzner API token stored in secrets manager
- [ ] Kubernetes secrets encrypted at rest
- [ ] Access to secrets limited to necessary personnel
- [ ] Backup of encryption key stored offline
- [ ] Key rotation plan documented (see below)

## 🔄 Key Rotation Plan

### Encryption Master Key Rotation

The encryption master key should be rotated periodically (recommended: annually).

**Process:**

1. Generate new master key: `openssl rand -hex 32`
2. Update `ENCRYPTION_MASTER_KEY` in secrets
3. Restart services with new key
4. Re-encrypt existing data with new key (migration script required)

**Note**: This requires a migration script to re-encrypt all PHI data. Will be implemented in Phase 4.

### R2 API Credentials Rotation

1. Create new R2 API token in Cloudflare
2. Update secrets with new credentials
3. Restart services
4. Revoke old token after verification

### Hetzner API Token Rotation

1. Create new API token in Hetzner Console
2. Update secrets with new token
3. Restart skillpod-svc
4. Delete old token after verification

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

1. **S3/R2 Operations**
   - Upload success rate
   - Download success rate
   - Latency (should be <200ms)
   - Error rate (should be <0.1%)

2. **Encryption Operations**
   - Encryption/decryption success rate
   - Latency (should be <10ms)
   - Key derivation failures

3. **Hetzner Volume Operations**
   - Volume creation success rate
   - Volume attach/detach success rate
   - API rate limits

### Alert Conditions

- S3 error rate > 1%
- Encryption failures > 0
- Volume creation failures > 0
- Hetzner API rate limit hit

## 🐛 Troubleshooting

### Issue: "Cannot connect to S3"

**Symptoms:**

- Avatar upload fails
- 500 errors in logs: "NetworkingError: Cannot connect to S3"

**Solutions:**

1. Verify `S3_ENDPOINT` is correct
2. Check R2 credentials are valid
3. For local dev: Ensure LocalStack is running (`docker ps | grep localstack`)
4. Test connectivity: `curl <S3_ENDPOINT>`

### Issue: "Encryption failed: Invalid master key"

**Symptoms:**

- Cannot encrypt PHI data
- Error: "ENCRYPTION_MASTER_KEY must be exactly 64 hexadecimal characters"

**Solutions:**

1. Verify master key is exactly 64 hex characters
2. Re-generate if needed: `openssl rand -hex 32`
3. Ensure no spaces or newlines in key
4. Restart service after updating

### Issue: "Hetzner API: Authentication failed"

**Symptoms:**

- Cannot create SkillPod volumes
- 401 errors from Hetzner API

**Solutions:**

1. Verify `HETZNER_API_TOKEN` is set
2. Check token is valid in Hetzner Console
3. Ensure token has Read & Write permissions
4. Regenerate token if expired

### Issue: "Volume already exists"

**Symptoms:**

- Error: "Volume with name 'skillpod-xxx' already exists"
- Cannot create new volumes

**Solutions:**

1. List volumes: `curl -H "Authorization: Bearer <token>" https://api.hetzner.cloud/v1/volumes`
2. Delete orphaned volumes via Hetzner Console
3. Ensure volume name is unique

## 📈 Cost Monitoring

### Expected Monthly Costs

**Cloudflare R2:**

- Storage: $0.015/GB (first 10GB free)
- Operations: $4.50 per million Class A, $0.36 per million Class B
- Egress: $0 (unlimited free)
- Estimated: ~$10-20/month for 100GB storage

**Hetzner Cloud:**

- Volumes: €0.06/GB/month
- API: Free (rate-limited)
- Estimated: ~$5-10/month for 10x 10GB volumes

**Total Infrastructure: ~$82/month** (vs $800/month on AWS)

**Savings: 90% ($718/month)**

## 📚 Additional Resources

- [QUICK_START.md](./QUICK_START.md) - 10-minute quick start guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Detailed change summary
- [PHASE_1_3_IMPLEMENTATION_COMPLETE.md](./PHASE_1_3_IMPLEMENTATION_COMPLETE.md) - Comprehensive setup guide
- [AWS_TO_HETZNER_MIGRATION_PLAN.md](./AWS_TO_HETZNER_MIGRATION_PLAN.md) - Full migration strategy

## ✅ Final Checklist

- [ ] All credentials obtained (R2, Hetzner, Encryption key)
- [ ] Local environment configured and tested
- [ ] LocalStack tested successfully
- [ ] Services start without errors
- [ ] Avatar upload tested locally
- [ ] PHI encryption tested locally
- [ ] Staging environment updated
- [ ] Staging deployment successful
- [ ] Staging tests passing
- [ ] Production secrets updated
- [ ] Production database backed up
- [ ] Production deployment successful
- [ ] Production health checks passing
- [ ] Critical user flows tested in production
- [ ] Monitoring configured
- [ ] 24-hour stability verified
- [ ] Team trained on new infrastructure
- [ ] Documentation updated

## 🎯 Success Criteria

Your migration is complete when:

1. ✅ All services running on Hetzner without AWS dependencies
2. ✅ Avatar/portfolio images uploading to Cloudflare R2
3. ✅ PHI data encrypted with local crypto (not AWS KMS)
4. ✅ SkillPod volumes created via Hetzner API
5. ✅ Cost reduced by 90% ($800 → $82/month)
6. ✅ No errors in logs for 48 hours
7. ✅ All tests passing
8. ✅ Production stable for 1 week

## 🚀 Next Phase (Optional Enhancements)

- [ ] Implement encryption key rotation script
- [ ] Set up Grafana dashboards for R2/Hetzner metrics
- [ ] Configure alerts for volume operations
- [ ] Implement automated backup to R2
- [ ] Set up CDN caching strategy
- [ ] Optimize R2 usage patterns
- [ ] Implement volume snapshot automation

---

**Questions or Issues?**
Refer to the troubleshooting section or check service logs for detailed error messages.
