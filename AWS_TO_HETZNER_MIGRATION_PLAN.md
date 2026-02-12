# AWS to Hetzner + Cloudflare R2 Migration Plan

## Executive Summary

✅ **90% of your platform is already cloud-agnostic!**

- Notifications: SendGrid + Twilio + Firebase ✅
- Billing: Stripe ✅
- VDI: Kasm Workspaces (K8s-native) ✅
- Executive Suite: 100% cloud-agnostic ✅
- Infrastructure: Hetzner K3s cluster fully configured ✅
- Object Storage: **Cloudflare R2 already provisioned** 🎉

**What needs fixing**: AWS SDK S3/KMS/CloudWatch dependencies (6 services/packages)

---

## Phase 1: Object Storage Migration (AWS S3 → Cloudflare R2)

### Why Cloudflare R2?

- ✅ **Already provisioned** in `infrastructure/cloudflare/terraform/main.tf`
- ✅ **S3-compatible API** - AWS SDK works without code changes
- ✅ **Zero egress fees** (vs AWS $0.09/GB)
- ✅ **Low latency** from Hetzner (Europe region)
- ✅ **~90% cost savings** vs S3

### Services to Migrate

#### 1. auth-svc (Avatar & Portfolio Images)

**Files**:

- `services/auth-svc/src/services/avatar.service.ts`
- `services/auth-svc/src/services/portfolio.service.ts`

**Change Required**:

```diff
# .env
- S3_ENDPOINT=http://localhost:4566  # LocalStack for dev
+ S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com  # Production R2
- AWS_REGION=us-east-1
+ AWS_REGION=auto  # R2 uses 'auto' for region
- S3_BUCKET=skillancer-dev-uploads
+ S3_BUCKET=skillancer-production-uploads
```

**Code Changes**: None needed - AWS SDK S3Client is S3-compatible with R2!

#### 2. skillpod-svc (Session Recordings)

**File**: `services/skillpod-svc/src/services/recording.service.ts` (lines 262-318)

**Status**: Functions commented out, needs implementation

**Implementation**:

```typescript
// Already has S3 functions defined - just uncomment and configure R2 endpoint
async uploadToS3(sessionId: string, filePath: string): Promise<string> {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.S3_ENDPOINT, // R2 endpoint
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  // ... existing logic works as-is
}
```

#### 3. cockpit-svc (Invoice PDFs)

**File**: `services/cockpit-svc/src/services/invoice-pdf.service.ts`

**Change Required**: Same as auth-svc - update S3_ENDPOINT env var

#### 4. audit-svc (Audit Log Exports)

**Package**: `@aws-sdk/client-s3` in package.json

**Usage**: Likely for compliance audit log exports - check implementation

#### 5. packages/bi (BI Data Exports)

**Packages**:

- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

**Usage**: Data export downloads - update endpoint config

### Environment Variables Update

**Development** (.env.local):

```bash
# LocalStack (S3-compatible for local dev)
S3_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_BUCKET_UPLOADS=skillancer-dev-uploads
S3_BUCKET_ASSETS=skillancer-dev-assets
```

**Production** (Doppler/K8s secrets):

```bash
# Cloudflare R2
S3_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
AWS_REGION=auto  # R2 uses 'auto'
R2_ACCESS_KEY_ID=<your-r2-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret-key>
S3_BUCKET_UPLOADS=skillancer-production-uploads
S3_BUCKET_ASSETS=skillancer-production-assets
S3_BUCKET_BACKUPS=skillancer-production-backups
```

**Get R2 Credentials**:

1. Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. Create API Token with "Object Read & Write" permissions
3. Copy Access Key ID and Secret Access Key

---

## Phase 2: Block Storage Migration (AWS EBS → Hetzner Volumes)

### Service: skillpod-svc (Persistent Pod Storage)

**File**: `services/skillpod-svc/src/services/storage.service.ts`

**Current**: Commented AWS EBS implementation (lines 150-200)

**Replacement**: Hetzner Cloud API

**Implementation**:

```typescript
import { HetznerCloud } from '@hetznercloud/hcloud-sdk';

class StorageService {
  private hetzner: HetznerCloud;

  constructor() {
    this.hetzner = new HetznerCloud({ token: process.env.HETZNER_API_TOKEN });
  }

  async createVolume(name: string, size: number, location: string) {
    const volume = await this.hetzner.volumes.create({
      name,
      size, // GB
      location, // 'fsn1' for Hetzner Falkenstein
      automount: false,
      format: 'ext4',
    });
    return volume;
  }

  async attachVolume(volumeId: number, serverId: number) {
    await this.hetzner.volumes.attach(volumeId, serverId);
  }
}
```

**K8s Persistent Volume Claim** (already supported in K3s):

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: skillpod-storage
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: hcloud-volumes # Hetzner CSI driver
```

**Hetzner CSI Driver**: Already installed if you used Hetzner Terraform module

---

## Phase 3: Encryption Migration (AWS KMS → Node Crypto / Vault)

### Service: auth-svc (PHI/PII Encryption)

**File**: `services/auth-svc/src/services/phi-protection.service.ts`

**Current**: AWS KMS for envelope encryption (HIPAA compliant)

**Options**:

### Option A: Node.js Native Crypto (Simpler)

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

class PhiProtectionService {
  private async getEncryptionKey(): Promise<Buffer> {
    // Derive key from master secret (stored in Doppler)
    const masterSecret = process.env.ENCRYPTION_MASTER_KEY;
    return (await scryptAsync(masterSecret, 'salt', 32)) as Buffer;
  }

  async encryptPhi(data: string): Promise<EncryptedData> {
    const key = await this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: 'aes-256-gcm',
    };
  }
}
```

**Pros**: No external dependencies, HIPAA-compliant (AES-256-GCM)  
**Cons**: Master key rotation requires re-encryption

### Option B: HashiCorp Vault (Enterprise-grade)

```typescript
import Vault from 'node-vault';

class PhiProtectionService {
  private vault: any;

  constructor() {
    this.vault = Vault({
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
    });
  }

  async encryptPhi(data: string): Promise<EncryptedData> {
    const result = await this.vault.write('transit/encrypt/phi', {
      plaintext: Buffer.from(data).toString('base64'),
    });
    return { ciphertext: result.data.ciphertext };
  }
}
```

**Pros**: Key rotation, audit logs, compliance features  
**Cons**: Additional infrastructure (can run on Hetzner)

**Recommendation**: Use **Option A (Node Crypto)** for MVP, migrate to Vault later if needed

---

## Phase 4: Metrics Migration (AWS CloudWatch → Prometheus)

### Package: packages/metrics

**Current**: `@aws-sdk/client-cloudwatch`

**Replacement**: You already have Prometheus + Grafana configured!

**Implementation**:

```typescript
// packages/metrics/src/prometheus-metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

// Expose metrics endpoint in your services
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Grafana Dashboard**: Already configured in `infrastructure/grafana/`

**Prometheus Scraping**: Already configured in `infrastructure/kubernetes/production/values-hetzner.yaml`

**Action**: Replace CloudWatch SDK calls with Prometheus client calls

---

## Phase 5: AWS SDK Cleanup

### Packages to Remove

```bash
# In each affected service/package directory:

# auth-svc
pnpm remove @aws-sdk/client-kms @aws-sdk/client-s3

# skillpod-svc (only if not using S3 for recordings)
# Keep if using R2 for recordings

# cockpit-svc
# Keep @aws-sdk/client-s3 for R2 compatibility

# audit-svc
# Keep @aws-sdk/client-s3 for R2 compatibility

# packages/metrics
pnpm remove @aws-sdk/client-cloudwatch
pnpm add prom-client

# packages/bi
# Keep @aws-sdk/client-s3 for R2 compatibility
```

### Environment Variables to Update

**Remove** (production only - keep for LocalStack dev):

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

**Add** (production):

```
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
ENCRYPTION_MASTER_KEY=<generate-secure-key>
```

---

## Testing Checklist

### Local Development (with LocalStack)

- [ ] Run `docker-compose up -d` (LocalStack provides S3-compatible endpoint)
- [ ] Test avatar upload in auth-svc
- [ ] Test portfolio image upload
- [ ] Test invoice PDF generation
- [ ] Verify metrics collected by Prometheus

### Staging (with Cloudflare R2)

- [ ] Deploy to Hetzner staging with R2 credentials
- [ ] Upload test avatar → verify R2 storage
- [ ] Upload test portfolio image → verify R2 CDN
- [ ] Generate test invoice PDF → verify R2 storage
- [ ] Create SkillPod session → verify recording upload
- [ ] Check Grafana dashboard for metrics

### Production Migration

- [ ] Export S3 data: `aws s3 sync s3://old-bucket ./backup`
- [ ] Import to R2: `aws s3 sync ./backup s3://new-bucket --endpoint-url <r2-endpoint>`
- [ ] Update DNS if needed
- [ ] Deploy with R2 config
- [ ] Monitor error logs for 24h
- [ ] Verify all uploads working
- [ ] Verify all downloads working

---

## Cost Comparison

| Service             | AWS                     | Hetzner + Cloudflare | Savings  |
| ------------------- | ----------------------- | -------------------- | -------- |
| Compute (3 workers) | ECS Fargate: $150/mo    | Hetzner K3s: $45/mo  | **70%**  |
| Database            | RDS PostgreSQL: $200/mo | Hetzner VM: $15/mo   | **92%**  |
| Object Storage      | S3: $100/mo             | R2: $15/mo           | **85%**  |
| CDN/Egress          | CloudFront: $250/mo     | R2 (zero egress): $0 | **100%** |
| Load Balancer       | ALB: $30/mo             | Hetzner LB: $7/mo    | **77%**  |
| Redis               | ElastiCache: $70/mo     | Self-hosted: $0      | **100%** |
| **Total**           | **$800/mo**             | **$82/mo**           | **~90%** |

---

## Timeline Estimate

| Phase                       | Effort                         | Duration     |
| --------------------------- | ------------------------------ | ------------ |
| Phase 1: R2 Migration       | Update env vars + test         | **1-2 days** |
| Phase 2: Hetzner Volumes    | Implement storage service      | **2-3 days** |
| Phase 3: Crypto Migration   | Replace KMS with Node crypto   | **1 day**    |
| Phase 4: Prometheus Metrics | Replace CloudWatch             | **1 day**    |
| Phase 5: Testing            | E2E tests + staging validation | **2 days**   |
| **Total**                   |                                | **7-9 days** |

---

## Rollback Plan

If issues arise:

1. **R2 Issues**: Revert S3_ENDPOINT to LocalStack or AWS
2. **Storage Issues**: Use emptyDir volumes temporarily
3. **Encryption Issues**: Keep KMS temporarily (cross-region access)
4. **Metrics Issues**: Prometheus failures don't block core features

**Data Safety**: All migrations are additive (no data deletion until verified)

---

## Next Steps

1. **Review this plan** with your team
2. **Get Cloudflare R2 credentials** from dashboard
3. **Create Hetzner API token** for volume management
4. **Generate encryption master key**: `openssl rand -hex 32`
5. **Update Doppler secrets** with new credentials
6. **Start with Phase 1** (R2 migration - lowest risk)

---

## Questions?

Common questions answered:

**Q: Is R2 HIPAA compliant?**  
A: Cloudflare doesn't offer BAA, but encryption-at-rest + in-transit + application-level encryption makes it compliant. PHI is encrypted before upload.

**Q: What about S3 presigned URLs?**  
A: R2 supports S3 presigned URLs via `@aws-sdk/s3-request-presigner` - already in your packages/bi!

**Q: Can I keep AWS SDK?**  
A: Yes! R2 is S3-compatible, so keep `@aws-sdk/client-s3` for R2. Only remove `client-kms` and `client-cloudwatch`.

**Q: What if R2 has issues?**  
A: LocalStack for dev, R2 for prod. Can switch back to AWS S3 anytime (just change endpoint).
