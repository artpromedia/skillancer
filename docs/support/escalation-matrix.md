# Support Escalation Matrix

## Overview

This document defines the escalation paths for support issues, response time expectations, and decision-making authority at each level.

---

## Tier Definitions

### Tier 1: Frontline Support

**Team:** Customer Support Representatives  
**Hours:** 24/7  
**Response Time:** 15 minutes (chat), 2 hours (email)

**Handles:**

- Account access issues (password reset, 2FA)
- Basic how-to questions
- Navigation and feature guidance
- Connect purchases and balance inquiries
- Profile completion assistance
- Standard troubleshooting

**Tools Access:**

- Admin Panel (read + limited actions)
- Zendesk/Intercom
- Internal knowledge base
- Status page

---

### Tier 2: Technical Support

**Team:** Senior Support Specialists  
**Hours:** Extended business hours (6am-10pm local)  
**Response Time:** 30 minutes (escalated), 4 hours (direct)

**Handles:**

- SkillPod session issues
- Complex account problems
- Payment processing issues
- Verification escalations
- API integration support
- Bug reproduction

**Tools Access:**

- Admin Panel (full access)
- Log viewer (limited)
- Basic database queries (read-only)
- Feature flag visibility

---

### Tier 3: Engineering Support

**Team:** On-call Engineers  
**Hours:** 24/7 (on-call rotation)  
**Response Time:** 15 minutes (P0/P1), 4 hours (P2)

**Handles:**

- Production incidents
- Data integrity issues
- Security concerns
- Infrastructure problems
- Complex bug investigation
- Performance issues

**Tools Access:**

- Full infrastructure access
- Database access
- Deployment capabilities
- Feature flags (modify)

---

### Tier 4: Executive Escalation

**Team:** CTO, VP Engineering, Head of Support  
**Hours:** Business hours + emergency  
**Response Time:** 1 hour (emergency), 24 hours (standard)

**Handles:**

- Legal and compliance issues
- High-value customer escalations
- PR/media situations
- Executive complaints
- Strategic decisions

---

## Escalation Flow

```
                    ┌─────────────────┐
                    │   Customer      │
                    │   Contact       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Tier 1        │
                    │   Frontline     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
    │   Technical    │ │  Billing  │ │   Trust   │
    │   Issues       │ │  Issues   │ │  & Safety │
    └────────┬───────┘ └─────┬─────┘ └─────┬─────┘
             │               │             │
    ┌────────▼───────┐ ┌─────▼─────┐ ┌─────▼─────┐
    │   Tier 2       │ │  Billing  │ │  T&S      │
    │   Tech Support │ │  Team     │ │  Team     │
    └────────┬───────┘ └─────┬─────┘ └─────┬─────┘
             │               │             │
    ┌────────▼───────────────▼─────────────▼─────┐
    │              Tier 3 Engineering             │
    │         (for production issues)             │
    └──────────────────┬─────────────────────────┘
                       │
              ┌────────▼────────┐
              │    Tier 4       │
              │    Executive    │
              └─────────────────┘
```

---

## Issue Categories & Routing

### Technical Issues

| Issue Type         | Initial Owner | Escalation Path | SLA |
| ------------------ | ------------- | --------------- | --- |
| Login problems     | Tier 1        | Tier 2 → Tier 3 | 4h  |
| SkillPod issues    | Tier 2        | Tier 3          | 2h  |
| Performance issues | Tier 2        | Tier 3          | 1h  |
| Bug reports        | Tier 1        | Tier 2 → Tier 3 | 24h |
| API errors         | Tier 2        | Tier 3          | 4h  |
| Data sync issues   | Tier 2        | Tier 3          | 4h  |

### Billing Issues

| Issue Type         | Initial Owner | Escalation Path  | SLA |
| ------------------ | ------------- | ---------------- | --- |
| Payment failed     | Tier 1        | Billing → Tier 3 | 4h  |
| Refund request     | Tier 1        | Billing          | 24h |
| Withdrawal issues  | Billing       | Tier 3 → Finance | 48h |
| Dispute resolution | Disputes Team | Legal            | 72h |
| Invoice problems   | Billing       | Finance          | 24h |
| Fee questions      | Tier 1        | Billing          | 4h  |

### Trust & Safety

| Issue Type         | Initial Owner | Escalation Path     | SLA |
| ------------------ | ------------- | ------------------- | --- |
| Harassment report  | T&S Team      | T&S Lead → Legal    | 4h  |
| Fraud suspicion    | T&S Team      | T&S Lead → Security | 2h  |
| Account compromise | Security      | Tier 3 → CISO       | 1h  |
| Fake profiles      | T&S Team      | T&S Lead            | 24h |
| Terms violation    | T&S Team      | Legal               | 24h |
| DMCA/Copyright     | Legal         | External Counsel    | 48h |

### Business Issues

| Issue Type          | Initial Owner | Escalation Path       | SLA |
| ------------------- | ------------- | --------------------- | --- |
| Enterprise inquiry  | Sales         | Account Exec          | 24h |
| Partnership request | BD Team       | BD Lead               | 48h |
| Press inquiry       | PR            | CEO/CMO               | 4h  |
| Legal threat        | Legal         | General Counsel → CEO | 2h  |
| Executive complaint | Tier 4        | CEO                   | 4h  |

---

## Severity Levels

### P0 - Critical

**Definition:** Complete service outage or security breach  
**Examples:**

- Platform completely down
- Data breach confirmed
- Payment processing unavailable
- SkillPod sessions not launching globally

**Response:**

- Immediate page to on-call
- All-hands until resolved
- Executive notification within 15 min
- External communication within 1 hour

### P1 - High

**Definition:** Major feature broken, significant user impact  
**Examples:**

- Login not working for segment of users
- Payments failing intermittently
- SkillPod recording not working
- Search returning incorrect results

**Response:**

- Page on-call within 15 min
- Engineering response within 30 min
- Update every 30 min until resolved
- Post-mortem required

### P2 - Medium

**Definition:** Feature degraded, workaround available  
**Examples:**

- Notifications delayed
- Profile images not uploading
- Export function broken
- Minor UI issues

**Response:**

- Ticket to engineering
- Response within 4 hours
- Resolution within 48 hours
- No external communication needed

### P3 - Low

**Definition:** Minor issue, cosmetic, or enhancement  
**Examples:**

- Typo in email
- Minor visual bug
- Feature suggestion
- Documentation error

**Response:**

- Ticket logged
- Prioritized in backlog
- No specific SLA

---

## Contact Directory

### Tier 1 - Frontline

| Role           | Contact                | Hours      |
| -------------- | ---------------------- | ---------- |
| Support Queue  | support@skillancer.com | 24/7       |
| Live Chat      | In-app widget          | 24/7       |
| Emergency Line | +1-XXX-XXX-XXXX        | P0/P1 only |

### Tier 2 - Specialists

| Team              | Contact                    | Hours    |
| ----------------- | -------------------------- | -------- |
| Tech Support Lead | techsupport@skillancer.com | 6am-10pm |
| Billing Team      | billing@skillancer.com     | 9am-6pm  |
| Verification Team | verify@skillancer.com      | 9am-6pm  |
| T&S Team          | trust@skillancer.com       | 24/7     |

### Tier 3 - Engineering

| Role              | Contact                  | Hours |
| ----------------- | ------------------------ | ----- |
| On-Call Primary   | #oncall-primary (Chat)   | 24/7  |
| On-Call Secondary | #oncall-secondary (Chat) | 24/7  |
| PagerDuty         | Automatic escalation     | 24/7  |

### Tier 4 - Executive

| Role            | Contact              | Hours          |
| --------------- | -------------------- | -------------- |
| Head of Support |                      | Business hours |
| VP Engineering  |                      | Business hours |
| CTO             |                      | Emergency only |
| CEO             |                      | Emergency only |
| Legal           | legal@skillancer.com | Business hours |

---

## Escalation Procedures

### Standard Escalation

1. **Document the issue**
   - Customer details
   - Issue description
   - Steps taken
   - Ticket ID

2. **Notify next tier**
   - Use designated chat channel
   - @mention appropriate person
   - Include ticket link

3. **Handoff**
   - Brief verbal/written summary
   - Stay available for questions
   - Update customer on escalation

4. **Track resolution**
   - Monitor ticket
   - Learn from resolution
   - Update knowledge base if needed

### Emergency Escalation (P0/P1)

1. **Immediate actions**
   - Page via PagerDuty
   - Post in #incidents chat channel
   - Update status page

2. **War room**
   - Join designated voice channel
   - Clear communication
   - One incident commander

3. **Communication cadence**
   - Internal: Every 15 min
   - External: Every 30 min
   - Executives: Significant updates only

4. **Resolution**
   - Confirm issue resolved
   - Update all channels
   - Begin post-mortem

---

## Authority Matrix

| Action                   | Tier 1 | Tier 2 | T&S  | Billing | Tier 3 | Tier 4 |
| ------------------------ | ------ | ------ | ---- | ------- | ------ | ------ |
| Password reset           | ✓      | ✓      | ✓    | ✓       | ✓      | ✓      |
| Add connects             | ✓      | ✓      | -    | ✓       | ✓      | ✓      |
| Disable 2FA              | -      | ✓      | -    | -       | ✓      | ✓      |
| Issue refund (<$100)     | -      | ✓      | -    | ✓       | -      | ✓      |
| Issue refund (>$100)     | -      | -      | -    | ✓       | -      | ✓      |
| Unlock account           | ✓      | ✓      | ✓    | -       | ✓      | ✓      |
| Suspend account          | -      | -      | ✓    | -       | -      | ✓      |
| Ban user                 | -      | -      | Lead | -       | -      | ✓      |
| Release escrow (dispute) | -      | -      | -    | Lead    | -      | ✓      |
| Modify database          | -      | -      | -    | -       | ✓      | ✓      |
| Deploy code              | -      | -      | -    | -       | ✓      | ✓      |
| Feature flags            | -      | -      | -    | -       | ✓      | ✓      |

---

## SLA Definitions

### First Response Time

| Channel   | Target    | Maximum |
| --------- | --------- | ------- |
| Live Chat | 2 min     | 5 min   |
| Email     | 2 hours   | 4 hours |
| Phone     | Immediate | 1 min   |

### Resolution Time by Severity

| Severity | Target   | Maximum  |
| -------- | -------- | -------- |
| P0       | 1 hour   | 4 hours  |
| P1       | 4 hours  | 8 hours  |
| P2       | 24 hours | 48 hours |
| P3       | 72 hours | 1 week   |

### Customer Satisfaction Targets

| Metric                   | Target |
| ------------------------ | ------ |
| CSAT                     | >90%   |
| NPS                      | >50    |
| First Contact Resolution | >70%   |
| Escalation Rate          | <15%   |

---

## Escalation Templates

### Chat Escalation Message

```
🚨 ESCALATION REQUEST

Ticket: #12345
Customer: [Name/Email]
Issue: [Brief description]
Severity: P[0-3]
Time Open: [Duration]
Attempts: [What's been tried]
Impact: [User/business impact]

Requesting: [Tier 2/3/4] assistance
```

### Customer Update (During Escalation)

```
Subject: Update on your support request #12345

Hi [Name],

I wanted to update you on your issue regarding [topic].

I've escalated this to our [specialist team / senior engineers]
who have more expertise in this area. They are currently
investigating and I expect to have more information within
[timeframe].

I'll keep you updated as we make progress.

Best,
[Agent Name]
```

### Post-Resolution Summary

```
Ticket: #12345
Resolution Time: [Duration]
Final Resolution: [What fixed it]
Root Cause: [If known]
Knowledge Base: [Article created/updated? Y/N]
Follow-up Required: [Y/N - details]
```
