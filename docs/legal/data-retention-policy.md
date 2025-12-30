# Data Retention Policy

## Overview

This policy defines how long Skillancer retains personal and business data, and the procedures for secure deletion when retention periods expire.

**Effective Date:** January 2024  
**Policy Owner:** Data Protection Officer  
**Review Frequency:** Annual

---

## Guiding Principles

1. **Minimization:** Retain only what is necessary
2. **Purpose Limitation:** Keep data only for stated purposes
3. **Legal Compliance:** Meet all regulatory retention requirements
4. **Security:** Protect data throughout its lifecycle
5. **Transparency:** Clearly communicate retention practices

---

## Retention Schedule

### User Account Data

| Data Type           | Retention Period           | Trigger          | Legal Basis |
| ------------------- | -------------------------- | ---------------- | ----------- |
| Profile information | Account lifetime + 30 days | Account deletion | Contract    |
| Email address       | Account lifetime + 30 days | Account deletion | Contract    |
| Password hash       | Account lifetime           | Account deletion | Contract    |
| Profile photo       | Account lifetime + 30 days | Account deletion | Contract    |
| Phone number        | Account lifetime + 30 days | Account deletion | Contract    |

### Authentication & Security

| Data Type             | Retention Period      | Trigger          | Legal Basis      |
| --------------------- | --------------------- | ---------------- | ---------------- |
| Login history         | 90 days               | Rolling          | Security         |
| Session tokens        | 24 hours after expiry | Session end      | Contract         |
| 2FA backup codes      | Account lifetime      | Account deletion | Contract         |
| Password reset tokens | 1 hour                | Token use/expiry | Contract         |
| Failed login attempts | 30 days               | Rolling          | Security         |
| Security audit logs   | 2 years               | Rolling          | Legal compliance |

### Financial & Transaction Data

| Data Type              | Retention Period           | Trigger          | Legal Basis |
| ---------------------- | -------------------------- | ---------------- | ----------- |
| Transaction records    | 7 years                    | Transaction date | Tax/legal   |
| Payment method details | Account lifetime + 30 days | Account deletion | Contract    |
| Invoice records        | 7 years                    | Invoice date     | Tax/legal   |
| Withdrawal history     | 7 years                    | Transaction date | Tax/legal   |
| Escrow records         | 7 years                    | Contract end     | Tax/legal   |
| Tax forms (W-9, etc.)  | 7 years                    | Form date        | Tax law     |

### Contract & Work Data

| Data Type         | Retention Period      | Trigger      | Legal Basis         |
| ----------------- | --------------------- | ------------ | ------------------- |
| Contract details  | 7 years               | Contract end | Legal               |
| Milestone records | 7 years               | Contract end | Legal               |
| Time entries      | 7 years               | Entry date   | Legal               |
| Work submissions  | Contract end + 1 year | Contract end | Contract            |
| Contract messages | 3 years               | Contract end | Legitimate interest |

### SkillPod Data

| Data Type          | Retention Period               | Trigger     | Legal Basis         |
| ------------------ | ------------------------------ | ----------- | ------------------- |
| Session recordings | Per contract (default 90 days) | Session end | Contract            |
| Keystroke logs     | 30 days                        | Session end | Consent             |
| Clipboard history  | 30 days                        | Session end | Consent             |
| Access logs        | 1 year                         | Session end | Security            |
| Session metadata   | 3 years                        | Session end | Legitimate interest |

### Communication Data

| Data Type              | Retention Period            | Trigger                  | Legal Basis         |
| ---------------------- | --------------------------- | ------------------------ | ------------------- |
| Direct messages        | 3 years after last activity | Account deletion or time | Contract            |
| Support tickets        | 3 years                     | Ticket closure           | Legitimate interest |
| Email notifications    | Not stored (sent only)      | -                        | -                   |
| Push notification logs | 30 days                     | Rolling                  | Operations          |

### Verification & Trust

| Data Type                | Retention Period                   | Trigger               | Legal Basis         |
| ------------------------ | ---------------------------------- | --------------------- | ------------------- |
| Identity documents       | Verification + 90 days             | Verification complete | Legal (KYC)         |
| Background check results | 3 years                            | Check date            | Contract            |
| Skill assessment results | Account lifetime                   | Account deletion      | Contract            |
| Reviews                  | Permanent (anonymized on deletion) | -                     | Legitimate interest |

### Analytics & Marketing

| Data Type             | Retention Period | Trigger          | Legal Basis         |
| --------------------- | ---------------- | ---------------- | ------------------- |
| Web analytics         | 26 months        | Collection       | Consent             |
| Marketing preferences | Account lifetime | Account deletion | Consent             |
| A/B test data         | 6 months         | Test end         | Legitimate interest |
| Email campaign data   | 2 years          | Campaign send    | Legitimate interest |

---

## Retention by User Type

### Active Users

- All data retained per schedule above
- Regular use resets "last activity" timers
- Notifications before data deletion (where applicable)

### Inactive Users (No login for 2+ years)

- Account remains active
- Marketing communications paused
- Data retained per normal schedule
- Annual email to confirm account desire

### Deleted Accounts

- Personal data deleted within 30 days
- Financial records retained (anonymized) for 7 years
- Fraud prevention data retained for 2 years
- Reviews anonymized (text retained, user removed)

### Banned/Suspended Users

- Account data retained for investigation
- After resolution: deleted or retained per ban type
- Fraud-related bans: 7 year retention
- Terms violations: 2 year retention

---

## Data Deletion Procedures

### Automated Deletion

The system automatically purges expired data:

```typescript
// Runs daily at 2:00 AM UTC
async function runRetentionCleanup() {
  // Session cleanup
  await deleteExpiredSessions();

  // Login history cleanup (90 days)
  await deleteOldLoginHistory(90);

  // Message cleanup (3 years inactive)
  await archiveInactiveMessages(3 * 365);

  // SkillPod recording cleanup
  await deleteExpiredRecordings();

  // Analytics cleanup (26 months)
  await deleteOldAnalytics(26 * 30);

  // Log cleanup results
  await logRetentionRun();
}
```

### Manual Deletion Requests

**Process:**

1. Request received via Settings or Support
2. Identity verified
3. 14-day cooling-off period
4. Deletion executed
5. Confirmation sent to user

**Script:**

```bash
# Admin command for account deletion
npm run admin:delete-user -- \
  --userId=user_123 \
  --reason="user_request" \
  --confirmedBy=admin@skillancer.com \
  --bypassCooldown=false
```

### Bulk Deletion (Inactive Accounts)

For accounts inactive >3 years:

1. Identify accounts with no login for 3+ years
2. Send reactivation email (30-day notice)
3. If no response, proceed to deletion
4. Retain minimal data per legal requirements

---

## Special Retention Cases

### Legal Hold

When litigation is anticipated or ongoing:

1. Legal notifies DPO of hold requirement
2. Retention automation suspended for affected data
3. Hold documented with scope and duration
4. Normal deletion resumes when hold lifted

### Regulatory Investigation

Data may be retained beyond normal periods for:

- Government investigations
- Regulatory inquiries
- Law enforcement requests

Documented with:

- Authority requesting
- Data scope
- Expected duration
- Legal review

### Dispute Resolution

For active disputes:

- All relevant data retained
- Retention extends until resolution + 30 days
- Includes messages, contracts, work submissions

---

## Anonymization Standards

When data is anonymized instead of deleted:

### Requirements

- Irreversibly de-identified
- No re-identification possible
- Statistical utility preserved

### Techniques Used

1. **K-anonymity:** Generalize to groups of K+ individuals
2. **Data masking:** Replace identifiers with tokens
3. **Aggregation:** Store only summary statistics
4. **Pseudonymization:** Replace with random identifiers

### Example: Review Anonymization

```typescript
// Before
{
  reviewId: "review_123",
  authorId: "user_456",
  authorName: "John Smith",
  recipientId: "user_789",
  rating: 5,
  comment: "Excellent work on the React project!",
  createdAt: "2024-01-15"
}

// After anonymization
{
  reviewId: "review_123",
  authorId: null,
  authorName: "Skillancer User",
  recipientId: "user_789",
  rating: 5,
  comment: "Excellent work on the React project!",
  createdAt: "2024-01"  // Reduced precision
}
```

---

## Backup Retention

### Backup Schedule

| Backup Type      | Frequency | Retention | Storage             |
| ---------------- | --------- | --------- | ------------------- |
| Continuous (WAL) | Real-time | 7 days    | AWS S3              |
| Daily snapshot   | Daily     | 30 days   | AWS S3              |
| Weekly snapshot  | Weekly    | 90 days   | AWS S3 Glacier      |
| Monthly snapshot | Monthly   | 1 year    | AWS S3 Glacier      |
| Annual archive   | Yearly    | 7 years   | AWS S3 Glacier Deep |

### Backup Deletion

When user data is deleted:

1. Live database updated immediately
2. Daily backups cycle out within 30 days
3. Weekly backups cycle out within 90 days
4. For GDPR erasure: documented as "pending full deletion"
5. Full erasure complete when all backups cycled

---

## Compliance Verification

### Monitoring

```sql
-- Daily retention compliance check
SELECT
  data_category,
  COUNT(*) as records,
  MIN(created_at) as oldest_record,
  MAX(retention_days) as max_retention
FROM data_inventory
WHERE created_at < NOW() - INTERVAL retention_days DAY
GROUP BY data_category;
```

### Audit Reports

Monthly reports include:

- Data deleted per category
- Outstanding deletion requests
- Legal holds active
- Policy exceptions
- Compliance percentage

### Annual Review

- Policy reviewed and updated
- Retention periods validated against regulations
- New data categories assessed
- Stakeholder sign-off obtained

---

## Roles & Responsibilities

| Role        | Responsibility                                   |
| ----------- | ------------------------------------------------ |
| DPO         | Policy ownership, compliance oversight           |
| Engineering | Automation implementation, technical execution   |
| Legal       | Regulatory interpretation, legal hold management |
| Security    | Secure deletion verification, access control     |
| Support     | User request processing, communication           |
| Business    | Data requirement definition, exception requests  |

---

## Exception Process

For retention beyond standard periods:

1. **Request:** Business owner submits justification
2. **Review:** DPO assesses privacy impact
3. **Approval:** Legal and DPO sign-off required
4. **Documentation:** Exception logged with:
   - Data affected
   - Extended retention period
   - Justification
   - Approval chain
   - Review date
5. **Monitoring:** Included in quarterly compliance review

---

## Policy Updates

| Version | Date    | Changes        |
| ------- | ------- | -------------- |
| 1.0     | 2024-01 | Initial policy |

**Next Review:** January 2025

---

## Contact

**Data Protection Officer**  
Email: dpo@skillancer.com

**Privacy Team**  
Email: privacy@skillancer.com

**Legal Team**  
Email: legal@skillancer.com
