# Common Issues & Solutions

## Overview

This guide provides quick solutions to the most frequently reported issues by Skillancer users. Use this as a first reference before escalating to engineering.

---

## Account & Authentication

### Issue: Cannot log in / "Invalid credentials"

**Symptoms:**

- User enters correct credentials but gets error
- "Invalid email or password" message

**Troubleshooting Steps:**

1. Verify email address is spelled correctly
2. Check if Caps Lock is on
3. Try password reset flow
4. Check if account is locked (5+ failed attempts = 15 min lockout)

**Solutions:**

```
If account is locked:
→ Wait 15 minutes, or
→ Admin can unlock via: Admin Panel → Users → [Search user] → Unlock Account

If password reset fails:
→ Verify email in spam/promotions folder
→ Check email deliverability for their domain
→ Admin can manually reset: Admin Panel → Users → [Search user] → Reset Password
```

**Escalate if:** User claims they never registered, multiple users affected

---

### Issue: Email verification not received

**Symptoms:**

- User signed up but can't access account
- No verification email in inbox or spam

**Troubleshooting Steps:**

1. Check spam/promotions/updates folders
2. Verify email was typed correctly
3. Check if email bounced (Admin Panel → Emails → Bounces)

**Solutions:**

```
Resend verification:
→ User: Login page → "Resend verification email"
→ Admin: Admin Panel → Users → [Search] → Resend Verification

If email bounced:
→ User needs to update email address
→ Admin can update: Admin Panel → Users → [Search] → Edit Email
```

**Escalate if:** Multiple users from same domain affected (possible email deliverability issue)

---

### Issue: Two-factor authentication locked out

**Symptoms:**

- User lost access to 2FA device
- Backup codes not working

**Solutions:**

```
With backup codes:
→ User should use one of their 8 backup codes

Without backup codes (requires identity verification):
1. User submits request via support@skillancer.com
2. Verify identity:
   - Government ID matching account name
   - Answer security questions
   - Verify last transactions/activity
3. Admin disables 2FA: Admin Panel → Users → [Search] → Disable 2FA
4. Notify user to re-enable 2FA immediately
```

**Escalate if:** User cannot verify identity

---

## Profile & Verification

### Issue: Profile not appearing in search

**Symptoms:**

- Freelancer's profile not showing in search results
- "No results found" when searching by name

**Troubleshooting Steps:**

1. Check profile completeness (must be >80%)
2. Verify profile is set to "Active" not "Hidden"
3. Check if any skills are selected
4. Confirm availability status is not "Not Available"

**Solutions:**

```
Profile incomplete:
→ Guide user to complete: Settings → Profile → Fill all required fields
→ Check: Photo, Title, Bio, Skills (min 3), Hourly rate, Availability

Profile hidden:
→ Settings → Privacy → Toggle "Show my profile in search"

Recently updated:
→ Search index updates every 15 minutes
→ May take up to 30 minutes for new profiles
```

**Escalate if:** Profile is complete but still not appearing after 1 hour

---

### Issue: Skill verification failed

**Symptoms:**

- User failed assessment
- "Verification pending" for extended time

**Solutions:**

```
Failed assessment:
→ User can retake after 24 hours
→ Maximum 3 attempts per skill per month
→ Suggest practice resources

Pending verification:
→ ID verification: Usually 1-2 business days
→ Background check: 3-5 business days
→ Credential verification: 5-10 business days (depends on institution response)

If stuck in pending:
→ Check Admin Panel → Verifications → [Search] for status
→ May need to re-request verification from institution
```

**Escalate if:** Verification pending >10 business days

---

## Jobs & Proposals

### Issue: Cannot submit proposal

**Symptoms:**

- "Insufficient connects" error
- Submit button grayed out
- Error when submitting

**Troubleshooting Steps:**

1. Check user's connect balance (Profile → Connects)
2. Verify job is still open
3. Check if already submitted to this job
4. Verify profile is complete

**Solutions:**

```
Insufficient connects:
→ User can purchase: Profile → Connects → Buy Connects
→ Free connects refresh on 1st of each month (60 connects)

Job closed:
→ Job may have been filled or closed by client
→ Suggest similar open jobs

Already applied:
→ User can only submit one proposal per job
→ Can withdraw and resubmit (connects are not refunded)
```

**Escalate if:** User has connects but system shows error

---

### Issue: Job not getting proposals

**Symptoms:**

- Client posted job but no proposals received
- Very few proposals compared to similar jobs

**Troubleshooting Steps:**

1. Check job visibility (not set to "Invite Only")
2. Review job description for clarity
3. Check budget competitiveness
4. Verify payment method is verified

**Solutions:**

```
Improve visibility:
→ Add more specific skills
→ Clarify project scope and deliverables
→ Consider competitive budget range
→ Add company logo and description

Boost job:
→ Client can use "Featured Job" boost
→ Appears at top of search for 7 days
```

**Escalate if:** Job has been open 14+ days with <5 proposals

---

## Contracts & SkillPod

### Issue: SkillPod session won't start

**Symptoms:**

- "Launching workspace..." stuck
- Black screen after launching
- Session disconnects immediately

**Troubleshooting Steps:**

1. Check browser compatibility (Chrome 90+, Firefox 88+, Edge 90+)
2. Disable browser extensions (especially VPN, ad blockers)
3. Check internet connection stability
4. Try incognito/private mode
5. Clear browser cache

**Solutions:**

```
Browser issues:
→ Recommend Chrome for best experience
→ Disable extensions: chrome://extensions/

Connection issues:
→ Minimum: 10 Mbps download, 5 Mbps upload
→ Recommend wired connection over WiFi
→ Check: https://skillancer.com/speed-test

System requirements:
→ 4GB RAM minimum (8GB recommended)
→ Modern CPU (2015 or newer)

Still not working:
→ Try different network (not corporate VPN)
→ Check status.skillancer.com for outages
```

**Escalate if:** Multiple users affected, or user meets all requirements but still fails

---

### Issue: SkillPod session recording missing

**Symptoms:**

- Client cannot access recording
- "Recording not available" message
- Incomplete recording

**Troubleshooting Steps:**

1. Check if session was in a policy that enables recording
2. Verify session ended properly (not crashed/disconnected)
3. Check recording retention period (default 90 days)

**Solutions:**

```
Recording processing:
→ Recordings available within 1 hour of session end
→ Check: Contract → Sessions → [Session] → Recording status

Session crashed:
→ Recording may be incomplete
→ Last 5 minutes before crash may not be captured

Retention expired:
→ Default: 90 days
→ Enterprise: 1 year
→ Cannot be recovered after expiration
```

**Escalate if:** Recording should exist but is not available

---

## Payments & Billing

### Issue: Withdrawal pending/failed

**Symptoms:**

- Withdrawal stuck in "Processing"
- "Withdrawal failed" notification
- Funds not received after expected time

**Troubleshooting Steps:**

1. Check withdrawal method status (verified?)
2. Verify bank account/PayPal details
3. Check minimum withdrawal amount ($100)
4. Review for any holds on account

**Expected Processing Times:**

- PayPal: 1-2 business days
- Bank Transfer (US): 3-5 business days
- Bank Transfer (International): 5-10 business days
- Payoneer: 2-3 business days

**Solutions:**

```
Pending >5 business days:
→ Check bank for incoming ACH
→ Verify no returns/rejects from bank
→ May need to update banking details

Failed withdrawal:
→ Common: Incorrect account number, closed account
→ User must update payment method and retry
→ Funds return to Skillancer balance within 3 days
```

**Escalate if:** Funds not received after 15 business days, or repeated failures

---

### Issue: Escrow release dispute

**Symptoms:**

- Client won't release milestone
- Freelancer claims work is complete
- Both parties requesting intervention

**Dispute Resolution Process:**

1. Encourage direct communication first
2. Review contract terms and milestone requirements
3. Examine submitted work vs. requirements
4. Check message history for agreements

**Solutions:**

```
For minor disputes:
→ Suggest mediation call
→ Propose partial release
→ Review revision requirements

For formal dispute:
→ Either party can open dispute via Contract → Actions → Open Dispute
→ 72-hour response period
→ If unresolved, escalates to Skillancer arbitration

Arbitration criteria:
→ Work matches description
→ Deliverables received
→ Communication record
→ Prior agreements
```

**Escalate if:** Involves >$5,000, legal threats made, or abuse/harassment claims

---

## Technical Issues

### Issue: Page not loading / errors

**Symptoms:**

- 500 error page
- "Something went wrong" message
- Page stuck loading

**Troubleshooting Steps:**

1. Try refreshing the page
2. Clear browser cache and cookies
3. Try incognito mode
4. Try different browser
5. Check status.skillancer.com

**Solutions:**

```
Cache issues:
→ Clear: Settings → Privacy → Clear browsing data
→ Or use Ctrl+Shift+R (Cmd+Shift+R on Mac)

Specific page broken:
→ Note the URL and error message
→ Check if reproducible
→ Report to engineering with browser info

Widespread outage:
→ Check status page
→ Acknowledge to user
→ Provide estimated resolution time if known
```

**Escalate if:** Error persists across browsers, or affects multiple users

---

### Issue: Notifications not received

**Symptoms:**

- Missing email notifications
- Push notifications not working
- In-app notifications delayed

**Troubleshooting Steps:**

1. Check notification preferences (Settings → Notifications)
2. Verify email in spam folder
3. Check mobile app permissions
4. Test with a direct message

**Solutions:**

```
Email notifications:
→ Settings → Notifications → Email → Enable desired notifications
→ Add notifications@skillancer.com to contacts
→ Check domain isn't blocked by corporate email

Push notifications:
→ Mobile: App Settings → Notifications → Allow
→ Browser: Click lock icon → Site settings → Notifications

In-app:
→ Should be immediate
→ Try logging out and back in
```

**Escalate if:** User has all settings enabled but consistently missing notifications

---

## Quick Reference: Admin Panel Actions

| Action         | Path                              | Permission Required  |
| -------------- | --------------------------------- | -------------------- |
| Unlock account | Users → [Search] → Unlock         | Support              |
| Reset password | Users → [Search] → Reset Password | Support              |
| Disable 2FA    | Users → [Search] → Disable 2FA    | Support Lead         |
| Refund payment | Payments → [ID] → Refund          | Billing              |
| Add connects   | Users → [Search] → Add Connects   | Support              |
| Verify profile | Users → [Search] → Verify         | Verification Team    |
| Close dispute  | Disputes → [ID] → Resolve         | Disputes Team        |
| Ban user       | Users → [Search] → Ban            | Support Lead + Legal |

---

## Escalation Triggers

**Immediately escalate to engineering:**

- Multiple users reporting same issue
- Payment processing completely down
- Security-related concerns
- Data appearing incorrectly

**Immediately escalate to management:**

- Legal threats received
- Media/press inquiries
- High-value client complaints (>$50k spend)
- Harassment/abuse reports
