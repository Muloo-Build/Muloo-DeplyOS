# Phase B Acceptance Walkthrough

Date: 2026-04-21
Database: local Postgres at 127.0.0.1:5432 using `muloo_smoke`

## 1. Seed a fresh retainer

Use `pnpm db:seed:retainers` to reset the 10 verification scenarios. Scenario 1 is the fresh active retainer and Scenario 6 is the FIFO rollover case.

## 2. Verify FIFO rollover consumption (Scenario 6)

Initial rollover buckets:

- cmo8d7ru20023v87zr02mnk21: 5h remaining, expires 2026-05-01T08:31:53.184Z
- cmo8d7ru20025v87zh806x96k: 7h remaining, expires 2026-05-31T08:31:53.184Z

Approve the seeded complete task on Scenario 6:

- Endpoint: `POST /api/projects/cmo8d7ru1001xv87z6h40xib6/tasks/cmo8d7ru30027v87z3r5xekn1/approve-to-bill`
- Response status: 200

Bucket breakdown recorded on the ledger entry:

```json
{
  "rollover": [
    {
      "hours": 5,
      "bucketId": "cmo8d7ru20023v87zr02mnk21",
      "expiresAt": "2026-05-01T08:31:53.184Z"
    },
    {
      "hours": 3,
      "bucketId": "cmo8d7ru20025v87zh806x96k",
      "expiresAt": "2026-05-31T08:31:53.184Z"
    }
  ],
  "currentBlockHours": 0
}
```

Post-consumption buckets:

- cmo8d7ru20023v87zr02mnk21: 0h remaining (CONSUMED)
- cmo8d7ru20025v87zh806x96k: 4h remaining (ACTIVE)

## 3. Approve-to-bill flow (Scenario 1)

Run these calls in order against project `cmo8d7rth0007v87zvthiukr2`.

```json
[
  {
    "title": "Acceptance Task 1",
    "taskId": "cmo8d95en0007rnfyt7io6i6x",
    "plannedHours": 8,
    "createdStatus": 201,
    "completedStatus": 200,
    "approvedStatus": 200,
    "approvedBody": {
      "taskId": "cmo8d95en0007rnfyt7io6i6x",
      "ledgerEntry": {
        "id": "cmo8d95fd000crnfy54p645g2",
        "retainerPeriodId": "cmo8d7rtk000bv87zhwftlkuy",
        "taskId": "cmo8d95en0007rnfyt7io6i6x",
        "entryType": "TASK_CONSUMPTION",
        "hoursDelta": -8,
        "plannedHours": 8,
        "billedHours": 8,
        "producedBy": "HUMAN",
        "overrideReason": null,
        "metadata": {
          "serviceLine": "TECHNICAL_DELIVERY",
          "bucketBreakdown": {
            "rollover": [],
            "currentBlockHours": 8
          }
        },
        "createdBy": "smoke-user",
        "createdAt": "2026-04-21T08:32:57.529Z"
      },
      "retainerPeriod": {
        "id": "cmo8d7rtk000bv87zhwftlkuy",
        "retainerId": "cmo8d7rtg0005v87zp0gb7vqt",
        "periodMonth": "2026-04-01T00:00:00.000Z",
        "blockHours": 40,
        "rolledInHours": 0,
        "borrowedFromNext": 0,
        "borrowActive": false,
        "consumedHours": 8,
        "overageHours": 0,
        "rolledOutHours": 0,
        "approvedTopUpHours": 0,
        "balance": 32
      }
    }
  },
  {
    "title": "Acceptance Task 2 Override",
    "taskId": "cmo8d95fk000grnfyle3bdpqz",
    "plannedHours": 8,
    "createdStatus": 201,
    "completedStatus": 200,
    "approvedStatus": 200,
    "approvedBody": {
      "taskId": "cmo8d95fk000grnfyle3bdpqz",
      "ledgerEntry": {
        "id": "cmo8d95g3000lrnfysgrabpcz",
        "retainerPeriodId": "cmo8d7rtk000bv87zhwftlkuy",
        "taskId": "cmo8d95fk000grnfyle3bdpqz",
        "entryType": "TASK_CONSUMPTION",
        "hoursDelta": -4,
        "plannedHours": 8,
        "billedHours": 4,
        "producedBy": "HUMAN",
        "overrideReason": "Client goodwill adjustment for overlap",
        "metadata": {
          "serviceLine": "TECHNICAL_DELIVERY",
          "bucketBreakdown": {
            "rollover": [],
            "currentBlockHours": 4
          }
        },
        "createdBy": "smoke-user",
        "createdAt": "2026-04-21T08:32:57.555Z"
      },
      "retainerPeriod": {
        "id": "cmo8d7rtk000bv87zhwftlkuy",
        "retainerId": "cmo8d7rtg0005v87zp0gb7vqt",
        "periodMonth": "2026-04-01T00:00:00.000Z",
        "blockHours": 40,
        "rolledInHours": 0,
        "borrowedFromNext": 0,
        "borrowActive": false,
        "consumedHours": 12,
        "overageHours": 0,
        "rolledOutHours": 0,
        "approvedTopUpHours": 0,
        "balance": 28
      }
    }
  },
  {
    "title": "Acceptance Task 3",
    "taskId": "cmo8d95gc000prnfy6x61a5z1",
    "plannedHours": 10,
    "createdStatus": 201,
    "completedStatus": 200,
    "approvedStatus": 200,
    "approvedBody": {
      "taskId": "cmo8d95gc000prnfy6x61a5z1",
      "ledgerEntry": {
        "id": "cmo8d95gt000urnfyq9zwfg5o",
        "retainerPeriodId": "cmo8d7rtk000bv87zhwftlkuy",
        "taskId": "cmo8d95gc000prnfy6x61a5z1",
        "entryType": "TASK_CONSUMPTION",
        "hoursDelta": -10,
        "plannedHours": 10,
        "billedHours": 10,
        "producedBy": "HUMAN",
        "overrideReason": null,
        "metadata": {
          "serviceLine": "TECHNICAL_DELIVERY",
          "bucketBreakdown": {
            "rollover": [],
            "currentBlockHours": 10
          }
        },
        "createdBy": "smoke-user",
        "createdAt": "2026-04-21T08:32:57.582Z"
      },
      "retainerPeriod": {
        "id": "cmo8d7rtk000bv87zhwftlkuy",
        "retainerId": "cmo8d7rtg0005v87zp0gb7vqt",
        "periodMonth": "2026-04-01T00:00:00.000Z",
        "blockHours": 40,
        "rolledInHours": 0,
        "borrowedFromNext": 0,
        "borrowActive": false,
        "consumedHours": 22,
        "overageHours": 0,
        "rolledOutHours": 0,
        "approvedTopUpHours": 0,
        "balance": 18
      }
    }
  },
  {
    "title": "Acceptance Task 4",
    "taskId": "cmo8d95h2000yrnfyeo6s9338",
    "plannedHours": 10,
    "createdStatus": 201,
    "completedStatus": 200,
    "approvedStatus": 200,
    "approvedBody": {
      "taskId": "cmo8d95h2000yrnfyeo6s9338",
      "ledgerEntry": {
        "id": "cmo8d95hj0013rnfy505he6n0",
        "retainerPeriodId": "cmo8d7rtk000bv87zhwftlkuy",
        "taskId": "cmo8d95h2000yrnfyeo6s9338",
        "entryType": "TASK_CONSUMPTION",
        "hoursDelta": -10,
        "plannedHours": 10,
        "billedHours": 10,
        "producedBy": "HUMAN",
        "overrideReason": null,
        "metadata": {
          "serviceLine": "TECHNICAL_DELIVERY",
          "bucketBreakdown": {
            "rollover": [],
            "currentBlockHours": 10
          }
        },
        "createdBy": "smoke-user",
        "createdAt": "2026-04-21T08:32:57.607Z"
      },
      "retainerPeriod": {
        "id": "cmo8d7rtk000bv87zhwftlkuy",
        "retainerId": "cmo8d7rtg0005v87zp0gb7vqt",
        "periodMonth": "2026-04-01T00:00:00.000Z",
        "blockHours": 40,
        "rolledInHours": 0,
        "borrowedFromNext": 0,
        "borrowActive": false,
        "consumedHours": 32,
        "overageHours": 0,
        "rolledOutHours": 0,
        "approvedTopUpHours": 0,
        "balance": 8
      }
    }
  },
  {
    "title": "Acceptance Task 5 Borrow",
    "taskId": "cmo8d95hr0017rnfyy4h05r41",
    "plannedHours": 10,
    "createdStatus": 201,
    "completedStatus": 200,
    "approvedStatus": 200,
    "approvedBody": {
      "taskId": "cmo8d95hr0017rnfyy4h05r41",
      "ledgerEntry": {
        "id": "cmo8d95i9001crnfyir86ml08",
        "retainerPeriodId": "cmo8d7rtk000bv87zhwftlkuy",
        "taskId": "cmo8d95hr0017rnfyy4h05r41",
        "entryType": "TASK_CONSUMPTION",
        "hoursDelta": -10,
        "plannedHours": 10,
        "billedHours": 10,
        "producedBy": "HUMAN",
        "overrideReason": null,
        "metadata": {
          "serviceLine": "TECHNICAL_DELIVERY",
          "bucketBreakdown": {
            "rollover": [],
            "currentBlockHours": 10
          }
        },
        "createdBy": "smoke-user",
        "createdAt": "2026-04-21T08:32:57.634Z"
      },
      "retainerPeriod": {
        "id": "cmo8d7rtk000bv87zhwftlkuy",
        "retainerId": "cmo8d7rtg0005v87zp0gb7vqt",
        "periodMonth": "2026-04-01T00:00:00.000Z",
        "blockHours": 40,
        "rolledInHours": 0,
        "borrowedFromNext": 2,
        "borrowActive": true,
        "consumedHours": 42,
        "overageHours": 0,
        "rolledOutHours": 0,
        "approvedTopUpHours": 0,
        "balance": -4
      }
    }
  },
  {
    "title": "Acceptance Task 6 Overage",
    "taskId": "cmo8d95ig001grnfyartvk4qj",
    "plannedHours": 10,
    "createdStatus": 201,
    "completedStatus": 200,
    "approvedStatus": 402,
    "approvedBody": {
      "error": "overage_requires_topup",
      "shortfall": 12,
      "borrowCapRemaining": 8,
      "suggestedTopUpHours": 10,
      "topUpId": "cmo8d95j0001lrnfy4qphdkdy"
    }
  }
]
```

What this proves:

- Task 1 created a normal ledger entry for 8 billed hours
- Task 2 stored a 4 hour override with a reason
- Task 5 pushed the period into borrow with `borrowedFromNext = 2`
- Task 6 returned `402 overage_requires_topup` with an auto-generated top-up quote

## 4. Approve the top-up from the client endpoint

Client login:

```json
{
  "status": 200,
  "body": {
    "authenticated": true,
    "user": {
      "id": "cmo8d7rte0003v87zl9xxoumh",
      "firstName": "Seed",
      "lastName": "Approver",
      "email": "seed-approver+scenario-1@muloo.local",
      "authStatus": "invite_pending"
    }
  }
}
```

Top-up before approval:

```json
{
  "id": "cmo8d95j0001lrnfy4qphdkdy",
  "hours": 10,
  "rate": 1700,
  "status": "QUOTED"
}
```

Top-up approval response:

```json
{
  "status": 200,
  "body": {
    "topUp": {
      "id": "cmo8d95j0001lrnfy4qphdkdy",
      "status": "APPROVED",
      "approvedAt": "2026-04-21T08:32:57.670Z"
    },
    "ledgerEntry": {
      "id": "cmo8d95jc001prnfye7h9xfji",
      "retainerPeriodId": "cmo8d7rtk000bv87zhwftlkuy",
      "taskId": null,
      "entryType": "TOP_UP",
      "hoursDelta": 10,
      "plannedHours": null,
      "billedHours": null,
      "producedBy": null,
      "overrideReason": null,
      "metadata": {
        "rate": 1700,
        "topUpId": "cmo8d95j0001lrnfy4qphdkdy"
      },
      "createdBy": "cmo8d7rte0003v87zl9xxoumh",
      "createdAt": "2026-04-21T08:32:57.672Z"
    },
    "retainerPeriod": {
      "id": "cmo8d7rtk000bv87zhwftlkuy",
      "retainerId": "cmo8d7rtg0005v87zp0gb7vqt",
      "periodMonth": "2026-04-01T00:00:00.000Z",
      "blockHours": 40,
      "rolledInHours": 0,
      "borrowedFromNext": 2,
      "borrowActive": true,
      "consumedHours": 42,
      "overageHours": 10,
      "rolledOutHours": 0,
      "approvedTopUpHours": 10,
      "balance": 6
    }
  },
  "headers": {}
}
```

Retry the original overage task after top-up approval:

```json
{
  "status": 200,
  "body": {
    "taskId": "cmo8d95ig001grnfyartvk4qj",
    "ledgerEntry": {
      "id": "cmo8d95jl001srnfyzmd2z0xe",
      "retainerPeriodId": "cmo8d7rtk000bv87zhwftlkuy",
      "taskId": "cmo8d95ig001grnfyartvk4qj",
      "entryType": "TASK_CONSUMPTION",
      "hoursDelta": -10,
      "plannedHours": 10,
      "billedHours": 10,
      "producedBy": "HUMAN",
      "overrideReason": null,
      "metadata": {
        "serviceLine": "TECHNICAL_DELIVERY",
        "bucketBreakdown": {
          "rollover": [],
          "currentBlockHours": 10
        }
      },
      "createdBy": "smoke-user",
      "createdAt": "2026-04-21T08:32:57.681Z"
    },
    "retainerPeriod": {
      "id": "cmo8d7rtk000bv87zhwftlkuy",
      "retainerId": "cmo8d7rtg0005v87zp0gb7vqt",
      "periodMonth": "2026-04-01T00:00:00.000Z",
      "blockHours": 40,
      "rolledInHours": 0,
      "borrowedFromNext": 10,
      "borrowActive": true,
      "consumedHours": 52,
      "overageHours": 10,
      "rolledOutHours": 0,
      "approvedTopUpHours": 10,
      "balance": -12
    }
  },
  "headers": {}
}
```

## 5. Confirm the open period state

```json
{
  "id": "cmo8d7rtk000bv87zhwftlkuy",
  "consumedHours": 52,
  "borrowedFromNext": 10,
  "borrowActive": true,
  "overageHours": 10,
  "topUps": [
    {
      "id": "cmo8d95j0001lrnfy4qphdkdy",
      "status": "APPROVED",
      "hours": 10,
      "rate": 1700
    }
  ],
  "ledgerEntries": [
    {
      "id": "cmo8d95fd000crnfy54p645g2",
      "entryType": "TASK_CONSUMPTION",
      "hoursDelta": -8,
      "billedHours": 8,
      "overrideReason": null,
      "metadata": {
        "serviceLine": "TECHNICAL_DELIVERY",
        "bucketBreakdown": {
          "rollover": [],
          "currentBlockHours": 8
        }
      }
    },
    {
      "id": "cmo8d95g3000lrnfysgrabpcz",
      "entryType": "TASK_CONSUMPTION",
      "hoursDelta": -4,
      "billedHours": 4,
      "overrideReason": "Client goodwill adjustment for overlap",
      "metadata": {
        "serviceLine": "TECHNICAL_DELIVERY",
        "bucketBreakdown": {
          "rollover": [],
          "currentBlockHours": 4
        }
      }
    },
    {
      "id": "cmo8d95gt000urnfyq9zwfg5o",
      "entryType": "TASK_CONSUMPTION",
      "hoursDelta": -10,
      "billedHours": 10,
      "overrideReason": null,
      "metadata": {
        "serviceLine": "TECHNICAL_DELIVERY",
        "bucketBreakdown": {
          "rollover": [],
          "currentBlockHours": 10
        }
      }
    },
    {
      "id": "cmo8d95hj0013rnfy505he6n0",
      "entryType": "TASK_CONSUMPTION",
      "hoursDelta": -10,
      "billedHours": 10,
      "overrideReason": null,
      "metadata": {
        "serviceLine": "TECHNICAL_DELIVERY",
        "bucketBreakdown": {
          "rollover": [],
          "currentBlockHours": 10
        }
      }
    },
    {
      "id": "cmo8d95i9001crnfyir86ml08",
      "entryType": "TASK_CONSUMPTION",
      "hoursDelta": -10,
      "billedHours": 10,
      "overrideReason": null,
      "metadata": {
        "serviceLine": "TECHNICAL_DELIVERY",
        "bucketBreakdown": {
          "rollover": [],
          "currentBlockHours": 10
        }
      }
    },
    {
      "id": "cmo8d95jc001prnfye7h9xfji",
      "entryType": "TOP_UP",
      "hoursDelta": 10,
      "billedHours": null,
      "overrideReason": null,
      "metadata": {
        "rate": 1700,
        "topUpId": "cmo8d95j0001lrnfy4qphdkdy"
      }
    },
    {
      "id": "cmo8d95jl001srnfyzmd2z0xe",
      "entryType": "TASK_CONSUMPTION",
      "hoursDelta": -10,
      "billedHours": 10,
      "overrideReason": null,
      "metadata": {
        "serviceLine": "TECHNICAL_DELIVERY",
        "bucketBreakdown": {
          "rollover": [],
          "currentBlockHours": 10
        }
      }
    }
  ]
}
```

## 6. Run reconciliation dry-run

```json
{
  "dryRun": true,
  "currentMonth": "2026-04-01T00:00:00.000Z",
  "actions": [
    {
      "retainerId": "cmo8d7rtm000hv87zq92ntahg",
      "clientName": "Seed Client - Scenario 2 (Under Utilised)",
      "closePeriodId": "cmo8d7rto000nv87zkd62eehj",
      "periodMonth": "2026-03-01T00:00:00.000Z",
      "endedInBorrow": false,
      "rolledOutHours": 10,
      "borrowedFromNext": 0,
      "expiredTopUpHours": 0,
      "nextPeriodMonth": "2026-04-01T00:00:00.000Z",
      "nextBlockHours": 40
    },
    {
      "retainerId": "cmo8d7rtp000tv87z7z4b5gio",
      "clientName": "Seed Client - Scenario 3 (Exactly At Block)",
      "closePeriodId": "cmo8d7rtr000zv87z77vvozj6",
      "periodMonth": "2026-03-01T00:00:00.000Z",
      "endedInBorrow": false,
      "rolledOutHours": 0,
      "borrowedFromNext": 0,
      "expiredTopUpHours": 0,
      "nextPeriodMonth": "2026-04-01T00:00:00.000Z",
      "nextBlockHours": 40
    },
    {
      "retainerId": "cmo8d7rtt0015v87z8go0o281",
      "clientName": "Seed Client - Scenario 4 (Borrow Active)",
      "closePeriodId": "cmo8d7rtu001bv87zi5i3nyb5",
      "periodMonth": "2026-03-01T00:00:00.000Z",
      "endedInBorrow": true,
      "rolledOutHours": 0,
      "borrowedFromNext": 5,
      "expiredTopUpHours": 0,
      "nextPeriodMonth": "2026-04-01T00:00:00.000Z",
      "nextBlockHours": 35
    },
    {
      "retainerId": "cmo8d7rtv001hv87zd1bdlxl4",
      "clientName": "Seed Client - Scenario 5 (Expired Rollover Bucket)",
      "closePeriodId": "cmo8d7rtw001nv87zdzijzw8g",
      "periodMonth": "2026-03-01T00:00:00.000Z",
      "endedInBorrow": false,
      "rolledOutHours": 10,
      "borrowedFromNext": 0,
      "expiredTopUpHours": 0,
      "nextPeriodMonth": "2026-04-01T00:00:00.000Z",
      "nextBlockHours": 40
    },
    {
      "retainerId": "cmo8d7ru4002dv87zzjt8ifew",
      "clientName": "Seed Client - Scenario 7 (Approved Top Up)",
      "closePeriodId": "cmo8d7ru5002jv87zkeeamdiz",
      "periodMonth": "2026-03-01T00:00:00.000Z",
      "endedInBorrow": true,
      "rolledOutHours": 0,
      "borrowedFromNext": 10,
      "expiredTopUpHours": 5,
      "nextPeriodMonth": "2026-04-01T00:00:00.000Z",
      "nextBlockHours": 30
    },
    {
      "retainerId": "cmo8d7rua0033v87zftuuntq3",
      "clientName": "Seed Client - Scenario 9 (Consulting)",
      "closePeriodId": "cmo8d7rub0039v87zqsdg40sz",
      "periodMonth": "2026-03-01T00:00:00.000Z",
      "endedInBorrow": false,
      "rolledOutHours": 0,
      "borrowedFromNext": 0,
      "expiredTopUpHours": 0,
      "nextPeriodMonth": "2026-04-01T00:00:00.000Z",
      "nextBlockHours": 20
    },
    {
      "retainerId": "cmo8d7rud003fv87zp8vbd3x6",
      "clientName": "Seed Client - Scenario 10 (USD Locked FX)",
      "closePeriodId": "cmo8d7ruf003lv87zdoa2dpgl",
      "periodMonth": "2026-03-01T00:00:00.000Z",
      "endedInBorrow": false,
      "rolledOutHours": 10,
      "borrowedFromNext": 0,
      "expiredTopUpHours": 0,
      "nextPeriodMonth": "2026-04-01T00:00:00.000Z",
      "nextBlockHours": 40
    }
  ],
  "overageRecommendations": []
}
```
