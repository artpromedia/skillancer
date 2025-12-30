# GDPR Compliance Guide

## Overview

This document outlines Skillancer's compliance with the General Data Protection Regulation (GDPR) for users in the European Economic Area (EEA), United Kingdom, and Switzerland.

**Last Updated:** January 2024  
**Data Protection Officer:** dpo@skillancer.com

---

## Data Controller Information

**Skillancer, Inc.**  
123 Market Street, Suite 500  
San Francisco, CA 94105  
United States

Email: privacy@skillancer.com  
Phone: +1-XXX-XXX-XXXX

EU Representative (per Article 27):  
[EU Representative Name]  
[Address]  
[Country]

---

## Lawful Bases for Processing

### Contract Performance (Article 6(1)(b))

We process data necessary to fulfill our contract with users:

| Data Category       | Purpose                                 | Retention                         |
| ------------------- | --------------------------------------- | --------------------------------- |
| Account information | User authentication, profile management | Duration of account + 30 days     |
| Transaction data    | Contract execution, payments            | 7 years (legal requirement)       |
| Communication data  | Service delivery, support               | 3 years after last contact        |
| SkillPod recordings | Contract verification, IP protection    | Per contract terms (up to 1 year) |

### Legitimate Interest (Article 6(1)(f))

| Data Category                   | Purpose              | Balancing Test                        |
| ------------------------------- | -------------------- | ------------------------------------- |
| Usage analytics                 | Platform improvement | Minimal privacy impact, user benefits |
| Fraud detection                 | Platform security    | Essential for all user protection     |
| Marketing to existing customers | Relevant offers      | Easy opt-out, limited frequency       |

### Consent (Article 6(1)(a))

| Data Category           | Purpose                    | Withdrawal Method          |
| ----------------------- | -------------------------- | -------------------------- |
| Marketing emails        | Promotional content        | Unsubscribe link in emails |
| Cookies (non-essential) | Analytics, personalization | Cookie settings in footer  |
| Profile visibility      | Public searchability       | Privacy settings           |

### Legal Obligation (Article 6(1)(c))

| Data Category         | Purpose              | Legal Basis           |
| --------------------- | -------------------- | --------------------- |
| Transaction records   | Tax compliance       | Local tax laws        |
| Identity verification | AML/KYC requirements | Financial regulations |
| Audit logs            | Security compliance  | Industry standards    |

---

## Data Subject Rights

### Right to Access (Article 15)

Users can request a copy of their personal data:

**Process:**

1. User submits request via Settings → Privacy → Download My Data
2. Identity verification (may require additional confirmation)
3. Data compiled within 30 days
4. Delivered as downloadable ZIP file

**Data Included:**

- Profile information
- Account settings
- Transaction history
- Messages sent/received
- Login history
- Consent records

**Admin Process:**

```
Admin Panel → Users → [Search] → Data Export → Generate Full Export
```

---

### Right to Rectification (Article 16)

Users can correct inaccurate data:

**Self-Service:**

- Profile information: Settings → Profile → Edit
- Contact details: Settings → Account → Edit
- Company information: Settings → Company → Edit

**Requires Support:**

- Email address change (verification required)
- Legal name change (documentation required)
- Transaction history corrections

---

### Right to Erasure (Article 17)

Users can request account deletion:

**Process:**

1. User requests via Settings → Account → Delete Account
2. 14-day cooling-off period
3. User confirms deletion via email
4. Account and personal data erased within 30 days

**Data Retained (Legal Requirement):**

- Transaction records (7 years) - anonymized
- Tax documentation (7 years)
- Fraud prevention data (2 years)
- Legal dispute records (until resolved)

**Erasure Script:**

```typescript
// Executed by automated system
async function eraseUser(userId: string) {
  // Anonymize financial records
  await anonymizeTransactions(userId);

  // Delete personal data
  await deleteProfile(userId);
  await deleteMessages(userId);
  await deleteSkillPodRecordings(userId);

  // Delete account
  await deleteUser(userId);

  // Log deletion for audit
  await logDeletion(userId);
}
```

---

### Right to Data Portability (Article 20)

Users can export data in machine-readable format:

**Process:**

1. Settings → Privacy → Export My Data
2. Select data categories
3. Choose format (JSON or CSV)
4. Download generated within 24 hours

**Portable Data:**

- Profile information
- Skills and verifications
- Portfolio items
- Contract history
- Reviews given/received

---

### Right to Object (Article 21)

Users can object to processing based on legitimate interest:

**Marketing Opt-Out:**

- Settings → Notifications → Disable marketing
- Unsubscribe link in all marketing emails
- Processed within 48 hours

**Analytics Opt-Out:**

- Cookie settings → Disable analytics
- Settings → Privacy → Disable analytics tracking

---

### Right to Restrict Processing (Article 18)

Users can request restriction while disputes are resolved:

**Triggers:**

- Accuracy dispute pending
- Processing objection under review
- Erasure request pending legal review

**Implementation:**

- Account marked as "Restricted"
- Data stored but not processed
- User notified of restriction status

---

## International Data Transfers

### Transfer Mechanisms

**EU to US Transfers:**

- EU-US Data Privacy Framework (where applicable)
- Standard Contractual Clauses (SCCs)
- Supplementary measures per Schrems II

**Sub-Processors:**
| Processor | Purpose | Location | Mechanism |
|-----------|---------|----------|-----------|
| AWS | Infrastructure | US/EU | SCCs + Encryption |
| Stripe | Payments | US | Data Privacy Framework |
| Intercom | Support | US | SCCs |
| SendGrid | Email | US | SCCs |

### Transfer Impact Assessment

For each international transfer:

1. Legal framework of destination country assessed
2. Supplementary measures identified
3. Encryption in transit and at rest
4. Access controls and logging

---

## Data Protection Impact Assessment (DPIA)

### High-Risk Processing Activities

| Activity                   | Risk Level | DPIA Status  | Review Date |
| -------------------------- | ---------- | ------------ | ----------- |
| SkillPod session recording | High       | Completed    | Q1 2024     |
| Identity verification      | High       | Completed    | Q1 2024     |
| Skill assessment AI        | Medium     | Completed    | Q2 2024     |
| Fraud detection            | Medium     | Completed    | Q2 2024     |
| Marketing automation       | Low        | Not required | -           |

### SkillPod DPIA Summary

**Processing Description:**

- Recording of screen activity during secure sessions
- Keystroke logging (opt-in for high-security contracts)
- Clipboard monitoring (when enabled by client)

**Necessity & Proportionality:**

- Required for IP protection and contract verification
- Proportionate to security needs of sensitive work
- Less intrusive alternatives insufficient

**Risk Mitigation:**

- Clear disclosure before session start
- User consent for enhanced monitoring
- Automatic deletion per retention policy
- Access controls on recordings
- Encryption at rest

---

## Cookie Compliance

### Cookie Categories

| Category   | Purpose                  | Consent Required |
| ---------- | ------------------------ | ---------------- |
| Essential  | Authentication, security | No               |
| Functional | Preferences, settings    | No               |
| Analytics  | Usage understanding      | Yes              |
| Marketing  | Personalized ads         | Yes              |

### Cookie Banner Requirements

```html
<!-- Displayed on first visit -->
<div class="cookie-banner">
  <h3>We use cookies</h3>
  <p>
    We use essential cookies for site functionality and optional cookies for analytics and
    marketing.
  </p>

  <button onclick="acceptAll()">Accept All</button>
  <button onclick="acceptEssential()">Essential Only</button>
  <button onclick="showSettings()">Customize</button>

  <a href="/privacy#cookies">Learn more</a>
</div>
```

### Cookie Inventory

| Cookie      | Type       | Duration | Purpose          |
| ----------- | ---------- | -------- | ---------------- |
| session_id  | Essential  | Session  | Authentication   |
| csrf_token  | Essential  | Session  | Security         |
| preferences | Functional | 1 year   | User settings    |
| \_ga        | Analytics  | 2 years  | Google Analytics |
| \_fbp       | Marketing  | 3 months | Facebook Pixel   |

---

## Consent Management

### Consent Records

We maintain records of all consents:

```typescript
interface ConsentRecord {
  userId: string;
  consentType: string;
  granted: boolean;
  timestamp: Date;
  source: 'signup' | 'settings' | 'prompt';
  version: string; // Terms version consented to
  ipAddress: string;
  userAgent: string;
}
```

### Consent Withdrawal

All consents can be withdrawn:

- Marketing: Settings → Notifications → Disable
- Cookies: Cookie settings → Disable non-essential
- Profile visibility: Settings → Privacy → Hide profile

---

## Breach Notification

### Internal Process

1. **Detection & Assessment (0-4 hours)**
   - Identify scope and impact
   - Determine if personal data affected
   - Classify severity

2. **Containment (0-24 hours)**
   - Stop ongoing breach
   - Preserve evidence
   - Implement immediate fixes

3. **Notification Decisions (24-48 hours)**
   - DPA notification required if risk to rights
   - User notification required if high risk
   - Document decision rationale

### Notification Templates

**To Supervisory Authority (within 72 hours):**

```
Subject: Data Breach Notification - Skillancer, Inc.

1. Nature of breach: [Description]
2. Categories of data: [Types]
3. Approximate number of subjects: [Number]
4. DPO contact: dpo@skillancer.com
5. Likely consequences: [Impact assessment]
6. Measures taken: [Remediation steps]
```

**To Affected Users:**

```
Subject: Important Security Notice from Skillancer

Dear [Name],

We are writing to inform you of a security incident that may have
affected your personal data.

What Happened: [Clear description]

What Data Was Involved: [Specific data types]

What We Are Doing: [Remediation measures]

What You Can Do: [Recommended actions]

Contact: dpo@skillancer.com

[DPO Signature]
```

---

## Vendor Management

### Sub-Processor Requirements

All sub-processors must:

1. Sign Data Processing Agreement (DPA)
2. Demonstrate GDPR compliance
3. Implement appropriate security measures
4. Allow audit rights
5. Report breaches within 24 hours

### Sub-Processor List

Available at: https://skillancer.com/legal/subprocessors

Changes notified 30 days in advance via email to users who opted in.

---

## Training & Awareness

### Required Training

| Role          | Training            | Frequency |
| ------------- | ------------------- | --------- |
| All employees | GDPR Basics         | Annual    |
| Engineering   | Privacy by Design   | Annual    |
| Support       | Data Subject Rights | Quarterly |
| Security      | Breach Response     | Quarterly |
| Leadership    | Compliance Overview | Annual    |

---

## Audit & Review

### Internal Audits

| Area                 | Frequency | Last Audit | Next Audit |
| -------------------- | --------- | ---------- | ---------- |
| Data inventory       | Annual    | Dec 2023   | Dec 2024   |
| Consent records      | Quarterly | Oct 2023   | Jan 2024   |
| Sub-processors       | Annual    | Nov 2023   | Nov 2024   |
| Security measures    | Quarterly | Dec 2023   | Mar 2024   |
| Retention compliance | Annual    | Nov 2023   | Nov 2024   |

### Documentation Requirements

Maintain records of:

- Processing activities (Article 30)
- Consent records
- DPIA assessments
- Breach log
- Data subject requests
- Sub-processor agreements
