# Cockpit Dashboard Guide

Cockpit is your command center for managing freelance work on Skillancer. Track time, manage clients, create invoices, and monitor your business performance—all in one place.

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Time Tracking](#time-tracking)
3. [Client Management](#client-management)
4. [Invoicing](#invoicing)
5. [Financial Reports](#financial-reports)
6. [Platform Integrations](#platform-integrations)

---

## Dashboard Overview

### Accessing Cockpit

1. Log in to Skillancer
2. Click **"Cockpit"** in the main navigation
3. Or visit [skillancer.com/cockpit](https://skillancer.com/cockpit)

### Dashboard Layout

The Cockpit dashboard is organized into key sections:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Quick stats, notifications, profile               │
├─────────────────┬───────────────────────────────────────────┤
│                 │                                           │
│  Navigation     │  Main Content Area                        │
│  - Dashboard    │  (Changes based on selected section)      │
│  - Time         │                                           │
│  - Clients      │                                           │
│  - Invoices     │                                           │
│  - Reports      │                                           │
│  - Settings     │                                           │
│                 │                                           │
└─────────────────┴───────────────────────────────────────────┘
```

### Quick Stats

At a glance, see:

| Metric               | Description             |
| -------------------- | ----------------------- |
| **This Week**        | Hours worked this week  |
| **This Month**       | Total earnings          |
| **Pending**          | Unpaid invoices         |
| **Active Contracts** | Current work agreements |

### Widgets

Customize your dashboard with widgets:

- **Earnings Chart**: Weekly/monthly trends
- **Time Distribution**: Hours by client/project
- **Upcoming Deadlines**: Milestones and due dates
- **Recent Activity**: Latest transactions and events
- **Goal Progress**: Track towards targets

---

## Time Tracking

### Starting a Timer

#### Quick Start

1. Click **"Start Timer"** button (always visible in header)
2. Select client and project from dropdown
3. Add optional description
4. Click **"Start"**

#### From Contract

1. Navigate to specific contract
2. Click **"Track Time"**
3. Timer auto-fills client/project

### Manual Time Entry

For time worked without tracking:

1. Go to **Time → Add Entry**
2. Select date and time range
3. Choose client and project
4. Add description of work done
5. Click **"Save Entry"**

### Timer Controls

| Button     | Action                    |
| ---------- | ------------------------- |
| ▶️ Start   | Begin tracking            |
| ⏸️ Pause   | Pause (continues session) |
| ⏹️ Stop    | End and save session      |
| 🗑️ Discard | Delete current session    |

### Weekly Timesheet

View and edit time in spreadsheet format:

1. Go to **Time → Timesheet**
2. See week at a glance
3. Click cells to edit
4. Navigate weeks with arrows
5. Export as CSV or PDF

```
            Mon   Tue   Wed   Thu   Fri   Sat   Sun   Total
Client A    2.5   3.0   4.0   3.5   2.0   -     -     15.0h
Client B    1.5   2.0   1.0   2.5   3.0   -     -     10.0h
Client C    -     1.0   2.0   1.0   2.0   4.0   -     10.0h
────────────────────────────────────────────────────────────
Total       4.0   6.0   7.0   7.0   7.0   4.0   -     35.0h
```

### Time Categories

Organize time by category:

- **Billable**: Client-facing work
- **Non-Billable**: Internal tasks
- **Administrative**: Proposals, communication
- **Learning**: Skill development
- **Break**: Tracked pauses

### Work Diary (Hourly Contracts)

For Skillancer hourly contracts:

- Screenshots captured automatically
- Activity level tracked
- Memos logged with entries
- Data synced to contract

**Settings:**

1. Go to **Settings → Work Diary**
2. Configure screenshot frequency
3. Set blur preferences
4. Manage app exclusions

---

## Client Management

### Client List

Access all clients at **Clients → All Clients**

View includes:

- Client name and company
- Active contracts count
- Total billed
- Last activity date
- Status (active/archived)

### Client Profiles

Each client profile contains:

#### Overview Tab

- Contact information
- Company details
- Relationship timeline
- Notes and tags

#### Contracts Tab

- Active and past contracts
- Total value and hours
- Performance metrics

#### Invoices Tab

- Invoice history
- Outstanding balances
- Payment patterns

#### Communications Tab

- Message history (if integrated)
- Meeting notes
- Important documents

### Adding Clients

#### From Skillancer Contract

Clients are automatically created when you start a contract.

#### Manual Client

For external clients:

1. Go to **Clients → Add Client**
2. Enter client details:
   - Name and email
   - Company name
   - Address (for invoicing)
   - Tax ID (if applicable)
3. Save client profile

### Client Tags

Organize clients with tags:

- 🟢 Active
- 🔴 Priority
- 🔵 Retainer
- 🟡 Follow-up needed
- ⚫ Archived

### Contact Management

Add multiple contacts per client:

1. Open client profile
2. Go to **Contacts** tab
3. Click **"Add Contact"**
4. Enter name, role, email, phone
5. Set as primary if needed

---

## Invoicing

### Creating an Invoice

#### Quick Invoice

1. Click **"New Invoice"** from dashboard
2. Select client
3. Add line items:
   - Description
   - Quantity
   - Rate
   - Amount
4. Review totals
5. **Send** or **Save Draft**

#### From Time Entries

1. Go to **Invoices → Create from Time**
2. Select client
3. Choose date range
4. Review entries to include
5. Click **"Generate Invoice"**
6. Customize and send

### Invoice Templates

#### Creating Templates

1. Go to **Invoices → Templates**
2. Click **"New Template"**
3. Customize:
   - Header (logo, company info)
   - Colors and fonts
   - Terms and conditions
   - Footer text
4. Save template

#### Template Elements

| Element | Customization                   |
| ------- | ------------------------------- |
| Logo    | Upload company logo             |
| Colors  | Brand colors for accents        |
| Columns | Show/hide tax, quantity, etc.   |
| Notes   | Standard terms, payment info    |
| Footer  | Contact info, thank you message |

### Invoice Workflow

```
Draft → Sent → Viewed → Paid
         ↓
      Overdue → Reminder → Collections
```

### Payment Options

Configure how clients can pay:

- **Skillancer Payments**: Integrated, fastest
- **Bank Transfer**: Direct deposit details
- **PayPal**: Link to PayPal
- **Stripe**: Accept cards (requires setup)
- **Wise**: International payments

### Invoice Automation

Set up recurring invoices:

1. Go to **Invoices → Recurring**
2. Click **"New Recurring Invoice"**
3. Configure:
   - Client
   - Items (fixed or from time)
   - Frequency (weekly, monthly, etc.)
   - Start date
4. Activate

### Payment Reminders

Automatic reminders:

| When            | Action                |
| --------------- | --------------------- |
| On due date     | Payment reminder sent |
| 7 days overdue  | First follow-up       |
| 14 days overdue | Second follow-up      |
| 30 days overdue | Final notice          |

Customize in **Settings → Invoicing → Reminders**

---

## Financial Reports

### Available Reports

#### Earnings Report

- Total income by period
- Breakdown by client
- Comparison to previous periods
- Trend visualization

#### Time Report

- Hours by client/project
- Billable vs non-billable
- Utilization rate
- Weekly/monthly summaries

#### Invoice Report

- Outstanding invoices
- Paid vs unpaid
- Average payment time
- Collection rate

#### Expense Report

- Tracked expenses
- Categories breakdown
- Reimbursable items
- Tax-deductible expenses

### Generating Reports

1. Go to **Reports** section
2. Select report type
3. Configure parameters:
   - Date range
   - Clients (all or specific)
   - Projects
   - Categories
4. Click **"Generate"**
5. View, print, or export

### Export Options

| Format | Use Case              |
| ------ | --------------------- |
| PDF    | Sharing, printing     |
| CSV    | Spreadsheet analysis  |
| Excel  | Detailed manipulation |
| JSON   | Integration, backup   |

### Tax Reports

Generate tax-ready reports:

1. Go to **Reports → Tax**
2. Select tax year
3. Generate:
   - Annual income summary
   - Quarterly breakdowns
   - Expense summary
   - Platform fee deductions

### Custom Dashboards

Create personalized report views:

1. Go to **Reports → Custom Dashboard**
2. Add widgets:
   - Charts
   - Tables
   - KPI cards
3. Arrange layout
4. Save dashboard
5. Set as default (optional)

---

## Platform Integrations

### Available Integrations

#### Communication

| Platform | Features                     |
| -------- | ---------------------------- |
| Slack    | Notifications, time tracking |
| Discord  | Status updates               |
| Email    | Invoice delivery, reminders  |

#### Project Management

| Platform | Features                    |
| -------- | --------------------------- |
| Jira     | Sync tasks, log time        |
| Asana    | Project sync, time tracking |
| Trello   | Card-based time logging     |
| GitHub   | Commit-linked time entries  |

#### Accounting

| Platform   | Features                |
| ---------- | ----------------------- |
| QuickBooks | Sync invoices, expenses |
| Xero       | Financial data sync     |
| FreshBooks | Invoice integration     |
| Wave       | Expense tracking        |

#### Calendar

| Platform        | Features              |
| --------------- | --------------------- |
| Google Calendar | Block tracked time    |
| Outlook         | Meeting time tracking |
| Apple Calendar  | Event sync            |

### Setting Up Integrations

1. Go to **Settings → Integrations**
2. Find desired platform
3. Click **"Connect"**
4. Authorize access
5. Configure sync settings
6. Test connection

### Integration Settings

For each integration, configure:

- **Sync Frequency**: Real-time, hourly, daily
- **Data Direction**: One-way or two-way
- **Field Mapping**: Match data fields
- **Filters**: What data to sync

### Browser Extension

Install the Skillancer browser extension for:

- Quick time tracking from any page
- Website/URL tracking
- One-click timer start
- Task detection from URLs

### Desktop App

Download the desktop app for:

- System-wide timer
- App usage tracking
- Offline time tracking
- Desktop notifications
- Idle detection

---

## Settings & Preferences

### Profile Settings

- Display name
- Email preferences
- Timezone
- Language
- Date/time format

### Time Tracking Settings

- Default billable status
- Rounding rules
- Idle detection threshold
- Screenshot preferences
- Timer reminders

### Invoice Settings

- Default payment terms
- Tax configuration
- Invoice numbering
- Default notes
- Reminder schedule

### Notification Preferences

| Notification     | Options             |
| ---------------- | ------------------- |
| Payment received | Email, push, in-app |
| Invoice overdue  | Email, push         |
| Timer running    | Desktop reminder    |
| Weekly summary   | Email               |

---

## Keyboard Shortcuts

| Action           | Windows/Linux | Mac       |
| ---------------- | ------------- | --------- |
| Start/stop timer | Ctrl+Shift+T  | ⌘+Shift+T |
| New time entry   | Ctrl+N        | ⌘+N       |
| New invoice      | Ctrl+I        | ⌘+I       |
| Quick search     | Ctrl+K        | ⌘+K       |
| Dashboard        | Ctrl+D        | ⌘+D       |
| Reports          | Ctrl+R        | ⌘+R       |

---

## Getting Help

### Resources

- **Video Tutorials**: Step-by-step guides
- **Knowledge Base**: Detailed articles
- **Community Forum**: Tips from other users
- **Webinars**: Live training sessions

### Support

- **Chat**: Available in-app
- **Email**: cockpit@skillancer.com
- **Priority Support**: For premium accounts

---

_Cockpit—Your freelance business, under control._
