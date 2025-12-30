# SkillPod User Guide

SkillPod is Skillancer's secure, containerized development environment that enables freelancers to work on sensitive projects with complete isolation and auditability.

## Table of Contents

1. [What is SkillPod?](#what-is-skillpod)
2. [Starting a Secure Session](#starting-a-secure-session)
3. [Understanding Security Policies](#understanding-security-policies)
4. [Working Within Containment](#working-within-containment)
5. [Session Recordings](#session-recordings)
6. [Troubleshooting](#troubleshooting)

---

## What is SkillPod?

### Overview

SkillPod provides a Virtual Desktop Infrastructure (VDI) environment where freelancers can:

- Access client code and resources securely
- Work in a monitored, compliant environment
- Demonstrate skills for verification
- Ensure intellectual property protection

### Key Features

| Feature               | Description                               |
| --------------------- | ----------------------------------------- |
| **Isolation**         | Complete separation from local system     |
| **Recording**         | Full session capture for audit/review     |
| **Controlled Access** | Policy-based internet and resource access |
| **Compliance**        | Meets SOC 2, HIPAA, and GDPR requirements |
| **Verification**      | Proves skills in real-world scenarios     |

### When to Use SkillPod

SkillPod is required when:

- ✅ Contract specifies SkillPod requirement
- ✅ Working with sensitive client data
- ✅ Accessing proprietary code repositories
- ✅ Taking skill verification assessments
- ✅ Working on compliance-regulated projects

### Technical Requirements

**Minimum Requirements:**

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Stable internet connection (10+ Mbps recommended)
- Screen resolution: 1280x720 minimum
- JavaScript enabled

**Recommended:**

- 25+ Mbps internet connection
- 1920x1080 screen resolution
- Low-latency connection (<100ms)
- Hardware acceleration enabled

---

## Starting a Secure Session

### Launching from Contract

1. Navigate to your active contract
2. Click **"Launch SkillPod"** button
3. Review session policies
4. Accept terms and conditions
5. Wait for environment provisioning (30-60 seconds)

### Launching for Verification

1. Go to **Profile → Skills Verification**
2. Select skill to verify
3. Choose **"SkillPod Assessment"**
4. Review assessment requirements
5. Click **"Start Session"**

### Session Initialization

During initialization, SkillPod:

1. **Provisions Environment**: Creates isolated container
2. **Applies Policies**: Configures security restrictions
3. **Loads Resources**: Sets up tools and access
4. **Starts Recording**: Begins session capture
5. **Connects**: Opens VDI session in browser

### Environment Options

Depending on contract/verification, environments include:

| Environment             | Pre-Installed Tools                            |
| ----------------------- | ---------------------------------------------- |
| **Web Development**     | VS Code, Node.js, npm, Git, Chrome DevTools    |
| **Python/Data Science** | VS Code, Python, Jupyter, pandas, scikit-learn |
| **Java/Enterprise**     | IntelliJ IDEA, JDK, Maven, Docker              |
| **DevOps**              | Terminal, Docker, kubectl, Terraform, AWS CLI  |
| **Design**              | Figma (web), Adobe XD, Sketch (if licensed)    |

---

## Understanding Security Policies

### Policy Levels

Clients configure security policies based on project sensitivity:

#### Level 1: Standard

- Basic monitoring
- Internet access allowed
- Copy/paste enabled
- Local storage allowed

#### Level 2: Enhanced

- Full session recording
- Limited internet access (whitelisted domains)
- Copy/paste logged
- No local storage

#### Level 3: Strict

- Continuous monitoring
- No internet access
- Copy/paste disabled
- No external communication
- Watermarked screen

#### Level 4: Maximum Security

- All Level 3 restrictions
- Keystroke logging
- No screenshots
- Session time limits
- Manager approval required

### Viewing Active Policies

1. Click the **🔒 Security** icon in the SkillPod toolbar
2. Review current policy settings
3. See what actions are allowed/restricted
4. Understand monitoring level

### Common Restrictions

| Restriction     | Description                          |
| --------------- | ------------------------------------ |
| **Clipboard**   | Copy/paste may be disabled or logged |
| **Network**     | Internet limited to approved domains |
| **Downloads**   | May require approval                 |
| **Uploads**     | Files scanned before upload          |
| **Recording**   | Session may be recorded              |
| **Screenshots** | May be blocked or watermarked        |

---

## Working Within Containment

### Desktop Environment

SkillPod provides a full Linux desktop with:

- **File Manager**: Navigate project files
- **Terminal**: Command-line access
- **Code Editors**: VS Code, Vim, or IDE of choice
- **Browser**: For web development testing
- **Git**: Version control integration

### File System Structure

```
/home/skillpod/
├── project/           # Client project files (if provided)
├── workspace/         # Your working directory
├── shared/           # Files shared with client
└── tools/            # Pre-installed development tools
```

### Saving Your Work

**Within Session:**

- Use Git commits frequently
- Save files to `/home/skillpod/workspace/`
- Auto-save enabled in most editors

**End of Session:**

- Commit and push to client repository
- Files in `shared/` folder are accessible to client
- Unsaved work may be lost after session ends

### Keyboard Shortcuts

| Action             | Shortcut     |
| ------------------ | ------------ |
| Full screen        | F11          |
| Clipboard sync     | Ctrl+Shift+V |
| Take break (pause) | Ctrl+Shift+P |
| End session        | Ctrl+Shift+E |
| Help overlay       | Ctrl+Shift+H |

### Handling Connection Issues

If connection drops:

1. **Auto-Reconnect**: System attempts automatic reconnection
2. **Resume Session**: Your session persists for 5 minutes
3. **Manual Reconnect**: Click "Reconnect" if prompted
4. **Data Safe**: Unsaved work protected during brief disconnections

---

## Session Recordings

### What's Recorded

Depending on policy level:

| Element            | Recorded        |
| ------------------ | --------------- |
| Screen activity    | ✅ Always       |
| Audio (microphone) | ❌ Never        |
| Webcam             | ❌ Never        |
| Keystrokes         | 🔶 Level 4 only |
| Clipboard content  | 🔶 Level 2+     |
| Network requests   | 🔶 Level 2+     |

### Recording Privacy

- You're notified when recording starts
- Recording indicator always visible
- No audio or video from your webcam
- Recordings encrypted in transit and at rest

### Accessing Your Recordings

1. Go to **SkillPod → Session History**
2. Find the relevant session
3. Click **"View Recording"**
4. Navigate with timeline scrubber

### Recording Retention

| Type                  | Retention Period                |
| --------------------- | ------------------------------- |
| Verification sessions | 90 days                         |
| Contract work         | Per client policy (30-365 days) |
| Dispute-related       | Until resolution + 1 year       |

### Using Recordings for Disputes

Recordings serve as evidence for:

- Work completed
- Time spent
- Issues encountered
- Client instruction compliance

---

## Troubleshooting

### Common Issues

#### Session Won't Start

**Symptoms**: Stuck on loading, timeout errors

**Solutions**:

1. Check internet connection stability
2. Try a different browser
3. Disable browser extensions
4. Clear browser cache
5. Check if popup blockers are interfering

#### Poor Performance

**Symptoms**: Lag, stuttering, slow response

**Solutions**:

1. Close unnecessary browser tabs
2. Reduce screen resolution in settings
3. Connect to faster network
4. Disable hardware acceleration
5. Try wired connection instead of WiFi

#### Keyboard Issues

**Symptoms**: Keys not working, wrong characters

**Solutions**:

1. Check keyboard layout setting in SkillPod
2. Ensure browser is in focus
3. Disable conflicting browser shortcuts
4. Try the on-screen keyboard

#### Clipboard Not Working

**Symptoms**: Can't copy/paste between local and SkillPod

**Solutions**:

1. Check if clipboard is allowed by policy
2. Use the SkillPod clipboard sync button
3. Grant browser clipboard permissions
4. Try Ctrl+Shift+V for clipboard panel

#### Connection Drops

**Symptoms**: Frequent disconnections

**Solutions**:

1. Test internet stability
2. Switch from WiFi to wired
3. Contact ISP if persistent
4. Try at different time (network congestion)
5. Report to support if issue persists

### Getting Help

#### In-Session Support

1. Click **"?"** in SkillPod toolbar
2. Choose **"Live Chat"** for immediate help
3. Support can view your session (with permission)

#### Reporting Issues

1. Note the session ID (shown in toolbar)
2. Take screenshots of error messages
3. Contact support with details:
   - Session ID
   - Browser and version
   - Description of issue
   - Steps to reproduce

### Error Reference

| Error Code | Meaning                         | Solution                            |
| ---------- | ------------------------------- | ----------------------------------- |
| SP-001     | Environment provisioning failed | Retry or contact support            |
| SP-002     | Policy violation detected       | Review allowed actions              |
| SP-003     | Session timeout                 | Reconnect within 5 minutes          |
| SP-004     | Resource limit exceeded         | Contact client to adjust            |
| SP-005     | Network restriction blocked     | Check allowed domains               |
| SP-100     | Recording failed                | Session continues, support notified |

---

## Best Practices

### For Successful Sessions

1. **Test Before Starting**: Use practice sessions to verify setup
2. **Stable Connection**: Use wired internet when possible
3. **Close Unnecessary Apps**: Free up local resources
4. **Commit Often**: Save work frequently to Git
5. **Communicate**: Let client know if you encounter issues

### Security Compliance

1. **Follow Policies**: Respect all security restrictions
2. **Don't Attempt Bypasses**: Violations are logged and may end contract
3. **Report Concerns**: Flag any suspicious activity
4. **Protect Data**: Don't screenshot or record externally
5. **Clean Up**: Clear local browser cache after sensitive sessions

---

## FAQ

**Q: Can I use my own IDE?**
A: SkillPod provides pre-configured IDEs. Custom configurations may be available depending on client policy.

**Q: Are sessions recorded automatically?**
A: Recording starts based on contract policy. You're always notified when recording is active.

**Q: What happens if I lose connection?**
A: Sessions persist for 5 minutes. Reconnect to continue where you left off.

**Q: Can I access my local files?**
A: No, for security reasons. Files must be transferred through approved channels.

**Q: How long can sessions last?**
A: Typically 8 hours maximum, but varies by contract. Take breaks as needed.

---

_SkillPod—Secure work, verified skills, complete trust._
