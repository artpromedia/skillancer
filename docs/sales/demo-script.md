# SkillPod Enterprise - Demo Script

## Pre-Demo Preparation

### Before the Call

**Research the Prospect:**

- [ ] Company size and industry
- [ ] Key stakeholders and their roles
- [ ] Current VDI/remote access solution (if known)
- [ ] Recent news, funding, or initiatives
- [ ] Compliance requirements (HIPAA, SOC 2, etc.)
- [ ] Pain points mentioned in discovery

**Prepare the Environment:**

- [ ] Demo tenant is clean and working
- [ ] Test all integrations you'll show
- [ ] Have backup demo environment ready
- [ ] Clear desktop of personal items
- [ ] Test screen sharing and audio
- [ ] Have relevant customer case studies ready

**Customize for Audience:**
| Audience | Focus Areas |
|----------|-------------|
| CISO/Security | Zero trust, audit logs, DLP, encryption |
| CIO/IT Director | TCO, management overhead, integrations |
| Business Leader | Speed to deploy, user experience, ROI |
| Procurement | Pricing, contracts, compliance certs |

---

## Demo Flow (30 minutes)

### Opening (2 minutes)

**Set the Stage:**

> "Before I dive in, I want to make sure this demo is valuable for you. Based on our previous conversation, I understand you're looking to:
>
> - [Pain point 1]
> - [Pain point 2]
> - [Pain point 3]
>
> Is there anything else you'd like me to specifically cover today?"

**Confirm Attendees:**

> "I see we have [names]. Is everyone the right stakeholder to see this, or is anyone joining who I should know about?"

---

### The Problem (3 minutes)

**Paint the Picture:**

> "Let me start with what we hear from organizations like yours every day.
>
> [Show slide or talk through:]
>
> **The Remote Work Security Gap:**
>
> - Your employees are working from home, coffee shops, co-working spaces
> - They're accessing sensitive data on unmanaged devices
> - VPNs are bottlenecked and can't enforce what happens after connection
> - Contractors and vendors need access, but you can't give them VPN credentials
> - Audit time comes, and you're scrambling for access logs
>
> Does this resonate with what you're experiencing?"

**Transition:**

> "SkillPod solves this by giving every user a secure, isolated workspace that you fully control. Let me show you how."

---

### The Solution Demo (20 minutes)

#### Part 1: User Experience (5 minutes)

**Show the Login:**

> "Let's start with what your end users see. I'm going to log in as a typical employee."

1. Open the SkillPod web portal
2. Click "Sign In"
3. **Show SSO flow**: "Notice I'm redirected to your identity provider—Okta, Azure AD, whatever you use. No separate credentials."
4. Complete MFA if configured
5. Land on the session launcher

**Show Session Launch:**

> "Now I'll start a secure session. Watch how fast this is."

1. Click "Start Session"
2. Point out: "This is spinning up an isolated container just for me. No other user can access this."
3. Session opens (< 30 seconds)

**Show the Desktop:**

> "Here's my secure workspace. It looks and feels like a normal desktop, but:
>
> - Nothing is stored on my local device
> - All data stays in the secure environment
> - When I log out, this session is destroyed
> - Every action I take is logged"

1. Open a browser, access internal app
2. Open a document
3. Try to copy text (if DLP enabled, show it blocked)
4. Show clipboard policy in action

**Logout:**

> "When I'm done, I simply close the session. The container is destroyed, data is cleaned up, and there's no trace on my device."

1. End session
2. Show confirmation

---

#### Part 2: Admin Experience (7 minutes)

**Show the Admin Dashboard:**

> "Now let's look at what you as an administrator see."

1. Log in as admin
2. Show dashboard overview

**User Management:**

> "Here's where you manage users."

1. Navigate to Users
2. Show user list with status
3. **Provision a new user:**
   - "Watch how fast I can add someone. Click Add User, enter email, assign a policy."
   - "They'll get an invite email and can be working within minutes—not days."
4. Show bulk import option
5. Show user details page with session history

**Policy Management:**

> "This is where you define what users can and cannot do."

1. Navigate to Policies
2. Show existing policies (e.g., "Contractor - Restricted", "Employee - Standard")
3. **Edit or create a policy:**
   - Clipboard: "I can disable copy/paste entirely, or allow paste-in only"
   - File transfer: "Allow uploads but not downloads"
   - Session timeout: "Auto-disconnect after 8 hours"
   - Watermarks: "Show user email on screen"
   - Network: "Restrict to specific internal resources"

> "You define the rules once, assign users to policies, and we enforce them."

**Session Monitoring:**

> "You have full visibility into what's happening right now."

1. Navigate to Active Sessions
2. Show live sessions with user, duration, policy
3. Click into a session for details
4. **Shadow a session** (if available): "I can view what this user sees in real-time"
5. Show session recording playback

---

#### Part 3: Security & Compliance (5 minutes)

**Security Dashboard:**

> "Let's look at your security posture."

1. Navigate to Security
2. Show security events/alerts
3. Highlight: "Every policy violation, suspicious activity, and security event is captured"

**Audit Logs:**

> "This is what makes auditors happy."

1. Navigate to Audit Logs
2. Show filterable log entries
3. Filter by user, action, date range
4. **Export logs**: "You can export to CSV or stream to your SIEM"

> "When your auditor asks 'Who accessed sensitive data in Q3?', you can answer in seconds."

**Compliance Reports:**

> "We make compliance reporting easy."

1. Navigate to Reports
2. Show compliance report templates
3. Generate a sample report
4. Highlight: "SOC 2, HIPAA, GDPR—we've built reports for common frameworks"

---

#### Part 4: Integration (3 minutes)

**SSO Configuration:**

> "Integration with your identity provider is straightforward."

1. Navigate to SSO settings
2. Show SAML/OIDC configuration
3. Highlight: "Most customers complete SSO setup in under an hour"

**API Access:**

> "For automation and integration with your tools:"

1. Navigate to API settings
2. Show API key management
3. Highlight: "REST API for provisioning, monitoring, and data access"
4. Show webhook configuration

---

### Closing (5 minutes)

**Recap Value:**

> "So, let me summarize what you've seen:
>
> 1. **For your users**: Fast, frictionless access to a secure workspace from any device
> 2. **For your IT team**: Simple management, no infrastructure, instant provisioning
> 3. **For your security team**: Full visibility, policy enforcement, audit-ready logs
> 4. **For your business**: Reduced risk, faster onboarding, lower TCO"

**Address Questions:**

> "What questions do you have? What would you like me to show in more detail?"

[Handle questions]

**Next Steps:**

> "Based on what you've seen, here are the paths forward:
>
> **Option 1: Free Trial** (14 days)
>
> - Full Pro features
> - We'll help you connect your identity provider
> - Try with 10-25 users
>
> **Option 2: Guided Pilot** (30 days)
>
> - Extended trial with success criteria
> - Dedicated implementation support
> - Executive business review at conclusion
>
> **Option 3: Security Review**
>
> - Deep-dive with your security team
> - SOC 2 report review
> - Architecture documentation
>
> Which path makes the most sense for your organization?"

---

## Demo Scenarios

### Scenario A: Contractor Access

_Use when prospect has contractor/vendor access needs_

1. Show creating a "Contractor" policy with restrictions:
   - No file downloads
   - No clipboard out
   - Session watermarks enabled
   - 4-hour session limit
   - Access only to specific applications

2. Provision a contractor user:
   - "I can create this contractor, assign the policy, and they're working today"
   - "When the project ends, I deactivate with one click"

3. Show monitoring:
   - "I can see exactly what they accessed"
   - "If they try to exfiltrate data, we block it and alert you"

---

### Scenario B: Compliance/Audit Focus

_Use when prospect has regulatory requirements_

1. Show audit log capabilities:
   - Filter by user, action, date
   - Every login, file access, policy violation
   - Tamper-proof logging

2. Show session recording:
   - "Every session can be recorded"
   - "Playback shows exactly what the user did"
   - "This is your evidence for investigations"

3. Generate compliance report:
   - Select framework (SOC 2, HIPAA, etc.)
   - Generate PDF
   - "This is what you hand to your auditor"

4. Mention certifications:
   - SOC 2 Type II
   - ISO 27001
   - HIPAA BAA available

---

### Scenario C: VDI Replacement

_Use when prospect has legacy Citrix/VMware_

1. Compare deployment time:
   - "Show of hands—how long did Citrix take to deploy?"
   - "Let me provision a user right now and time it"
   - [Provision user in < 1 minute]

2. Compare management:
   - "How many people manage your VDI today?"
   - "With SkillPod, this is self-service"

3. Compare cost:
   - "What's your hardware refresh cycle?"
   - "What's your Citrix/VMware licensing?"
   - "SkillPod: $249/user/year, zero infrastructure"

4. Show co-existence:
   - "You don't have to rip and replace"
   - "Start with new users or contractors"
   - "Migrate gradually as leases expire"

---

### Scenario D: Executive Briefing

_Use for C-level or short attention spans_

1. Keep it high-level (skip technical details)

2. Focus on business outcomes:
   - "Enable secure remote work without VPN headaches"
   - "Reduce breach risk with zero-trust architecture"
   - "Cut IT costs by eliminating VDI infrastructure"
   - "Accelerate onboarding for employees and contractors"

3. Show dashboard only:
   - Active sessions
   - Security score
   - Cost per user

4. Customer proof:
   - "Regional Bank deployed to 2,500 users in 3 weeks"
   - "Biotech company enabled fully remote R&D team"

5. End with ROI:
   - "Typical customer sees 45% TCO reduction"
   - "Payback period: 6-9 months"

---

## Handling Demo Issues

### If Something Breaks

> "Technology sometimes has a mind of its own. Let me show you this differently..."

- Switch to backup demo environment
- Show screenshots if needed
- "This is actually a great opportunity to show our support: I'm going to open a ticket right now and show you how responsive we are."

### If Asked About a Missing Feature

> "Great question. That's not something we have today, but let me tell you what we do have..."

- Pivot to what exists
- Note the request: "I'm going to log this—it helps us prioritize our roadmap"
- Ask: "How critical is this for your decision?"

### If Audience is Distracted

> "I want to make sure I'm showing you what matters most. What specific use case should we focus on?"

- Pause and re-engage
- Ask questions to bring them back
- Shorten the remaining demo

---

## Post-Demo Checklist

- [ ] Send follow-up email within 2 hours
- [ ] Include demo recording (if permitted)
- [ ] Attach relevant case study
- [ ] Propose specific next step with dates
- [ ] Log notes in CRM
- [ ] Schedule internal debrief if team demo
- [ ] Send any promised materials (security docs, pricing, etc.)

---

## Demo Environment Setup

### Test Data Guidelines

**Sample Users:**

- admin@demo.skillpod.io (Admin)
- john.smith@demo.skillpod.io (Employee)
- contractor@external.com (Contractor)

**Sample Policies:**

- "Employee - Standard" (full access)
- "Contractor - Restricted" (no download, clipboard restricted)
- "Compliance - Audited" (session recording, watermarks)

**Sample Content:**

- Some "confidential" documents
- Sample internal web app
- Realistic folder structure

### Reset Procedure

Before each demo:

1. Delete any sessions/users from previous demo
2. Clear audit logs older than today
3. Test SSO flow
4. Test session launch
5. Verify policies are configured correctly

---

_Last updated: Sprint M3_
_Questions? Contact: sales-enablement@skillpod.io_
