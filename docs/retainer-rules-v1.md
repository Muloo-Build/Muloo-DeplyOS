# Muloo DeployOS Retainer Rules Specification

Version: 1.0  
Date: 17 April 2026  
Owner: Jarrud  
Status: Approved for build

## 1. Overview

A retainer is a pre-purchased block of hours a client buys from Muloo at a discounted rate in exchange for monthly commitment. Retainers are the primary recurring revenue mechanism for Muloo and the commercial spine of DeployOS.

This document defines how retainers are structured and priced, how hours are consumed, how borrow-forward and roll-over work, how overage is handled, and how billing and ledger behaviour must work.

## 2. Core Concepts

### 2.1 Retainer

A retainer has these attributes at creation:

- Client
- Service line: Technical Delivery or Consulting
- Block size: number of hours per month, integer, minimum 10
- Start date: calendar-aligned, always the 1st of a month
- Rate: derived from the rate rules in section 3.2
- Currency: locked at creation, never changes
- Status: `DRAFT`, `ACTIVE`, `PAUSED`, `ENDED`

### 2.2 Ledger

Each retainer has its own ledger: a running record of hours purchased, hours consumed, balance, borrow-forward state and roll-over state. One retainer equals one ledger. Ledgers do not merge.

### 2.3 Period

The retainer period is the calendar month. All retainer rules reset or reconcile on the 1st of each month at 00:00 in the workspace configured timezone. Default timezone is Africa/Johannesburg.

## 3. Pricing

### 3.1 Base Hourly Rates

| Service line | Base rate |
| --- | --- |
| Technical Delivery | R1,700/hour |
| Consulting | R2,200/hour |
| Discovery | Fixed-fee, not retainer |

### 3.2 Retainer Rates

Technical Delivery retainers receive block-size discounts:

| Block size | Technical Delivery rate |
| --- | --- |
| 10-50 hours/month | R1,700/hour |
| 51-100 hours/month | R1,615/hour |
| 101-150 hours/month | R1,564/hour |
| 151+ hours/month | R1,530/hour |

Consulting retainers do not receive block-size discounts. Consulting is always billed at a flat R2,200/hour regardless of block size.

### 3.3 Currency

Retainers can be denominated in ZAR, USD, GBP, EUR, AUD or CAD. Rate is converted at retainer creation using the current FX rate and locked. FX drift does not re-price an active retainer.

There is no per-currency discount. All pricing discounts are controlled by the block-size rate band only, and only for Technical Delivery.

## 4. Hour Consumption

### 4.1 Golden Rule

Hours are hours. When a task completes and is approved to bill, its billed hours are deducted from the retainer balance. The same rule applies regardless of who or what completed the task:

- Human operator: billed hours deducted
- AI agent: billed hours deducted
- Hybrid: billed hours deducted

There is no AI discount, no attribution percentage and no per-agent multiplier. The client sees hours used. Production attribution is internal only.

### 4.2 Planned Hours

Every task on the Delivery Board has a `plannedHours` value set at blueprint time. This is the default number deducted from the retainer on task completion and approve-to-bill.

### 4.3 Operator Override

Before a task is approved to bill, an operator can override the hours billed for that task:

- Override must be greater than or equal to 0 and less than or equal to 2x planned hours
- Reason is required if override differs from planned by more than 25%
- Override is logged on the ledger entry for audit

### 4.4 Approve-to-Bill Workflow

A task's hours are deducted from the retainer ledger only when:

1. Task status is complete
2. Operator has approved the task to bill
3. Any operator override has been applied

Completed but unapproved tasks appear in an awaiting approval queue and do not consume retainer hours.

### 4.5 Internal Reporting

The ledger records whether hours were produced by `HUMAN`, `AGENT` or `HYBRID`. This feeds internal margin reporting and must never be shown on client-facing screens or invoices.

## 5. Borrow-Forward

A client may consume up to 125% of monthly block size in a given month by borrowing from next month. Borrow-forward has a hard cap of 25% of block size, rounded down.

If a 40-hour retainer uses 50 hours in April, May has 30 block hours available before any roll-over or top-up mechanics.

Borrow-forward and roll-over are mutually exclusive in a given month. A month ends under block, in borrow, or in overage.

## 6. Roll-Over

Unused hours from a month may roll into the next month, capped at 25% of block size, rounded down. Rolled hours expire 90 days after the month they were earned in.

Consumption order is:

1. Oldest rolled-over hours first
2. Newer rolled-over hours next
3. Current month's block last

If a retainer ends or is paused, rolled-over hours expire immediately. They are not refunded, credited or transferred.

## 7. Overage

Overage begins when consumption exceeds monthly block plus borrow-forward cap. When overage is about to trigger:

1. Platform flags the retainer in the operator Command Centre
2. Platform auto-generates a top-up quote
3. Work on further tasks is paused until top-up approval or explicit operator continuation

Top-up quote attributes:

- Suggested hours: 10 by default
- Rate: base rate for service line, not retainer discount rate
- Expiry: current month only

If a client triggers overage in 2 consecutive months or 3 months in any rolling 6-month window, the platform surfaces a recommendation to increase the retainer block.

## 8. Multi-Retainer Clients

A client can hold multiple retainers simultaneously, but each retainer is scoped to a single service line. Each retainer has its own ledger. Hours cannot transfer between retainers in v1.

## 9. Discovery Is Not A Retainer

Discovery engagements are fixed-fee projects, not retainers. They do not draw from or interact with retainer ledgers. Discovery hours are tracked internally for margin analysis only.

## 10. Billing And Invoicing

Monthly blocks invoice on day 1 of the retainer month, prepaid. Overage top-ups invoice at month-end or immediately on top-up approval, operator choice. Roll-over and borrow-forward are not billed separately.

Xero invoices draft automatically from the retainer ledger. Operator reviews and sends. Auto-send is post-v1.

If a retainer is cancelled mid-month, unused hours are not refunded by default. Operator can override with a Xero credit note. Borrowed hours owed to Muloo are forgiven at cancellation.

## 11. Lifecycle

Statuses:

- `DRAFT`: created but not active
- `ACTIVE`: running, ledger consumes, invoices generate
- `PAUSED`: no new ledger entries, no invoices this month, roll-over and borrow frozen
- `ENDED`: terminated, ledger archived

Pause starts from the next billing cycle only. A retainer cannot be paused retroactively.

## 12. Key Calculations

Current balance:

```text
balance = blockHours + rolledInHours + approvedTopUpHours - consumedHours - borrowedFromNext
```

Borrow cap: `floor(blockHours * 0.25)`  
Roll-over cap: `floor(blockHours * 0.25)`  
Overage trigger: `consumedHours > blockHours + rolledInHours + borrowCap`

## 13. Out Of Scope For V1

- Agency partner portal and agency-side retainer management
- Hour transfer between retainers
- Automated Xero send
- Multi-currency within a single retainer
- Historical retainer import
- Custom rate overrides outside the rate rules
- Client-facing analytics beyond balance and usage history
