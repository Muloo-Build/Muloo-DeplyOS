# Reconciliation Dry-Run Summary

Date run: 2026-04-21  
Timezone basis: Africa/Johannesburg  
Raw output: [reconciliation-dry-run-20260421.json](/Users/jarrudvandermerwe/Work/03 Projects/Muloo-DeplyOS/docs/reconciliation-dry-run-20260421.json)

This summary is based on the dry-run response plus direct inspection of the seeded local database at `127.0.0.1:5432/muloo_smoke`.

## Snapshot

- Dry-run month boundary: `2026-04-01T00:00:00.000Z`
- Retainers reconciled: 7
- Retainers skipped: 3
- Overage recommendations surfaced: 0

## Per Scenario

| Scenario                      | Current state                                                                                      | Post-reconciliation state                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Fresh active retainer      | April 2026 open period, current-month only                                                         | Skipped. No prior open period to close.                                                                                                                                      |
| 2. Under-utilised             | March 2026 open period, 40h block, 20h consumed                                                    | Close March. Roll out 10h. Create April period with 40h block and 10h rolled in.                                                                                             |
| 3. Exactly at block           | March 2026 open period, 40h block, 40h consumed                                                    | Close March. No roll-over. Create April period with 40h block.                                                                                                               |
| 4. Borrow-active              | March 2026 open period, 40h block, 45h consumed, 5h borrowed                                       | Close March in borrow state. No roll-over. Create April period with 35h block.                                                                                               |
| 5. Expired rollover bucket    | March 2026 open period, 40h block, 6h rolled in, 10h consumed, one expired 6h bucket still present | Close March. Dry-run says 10h roll out and 40h next block. DB inspection shows the existing expired bucket should also be reconciled out during the month-close transaction. |
| 6. Mixed-age rollover buckets | April 2026 open period, current-month only                                                         | Skipped for reconciliation. FIFO consumption verified separately in the acceptance walkthrough.                                                                              |
| 7. Approved top-up            | March 2026 open period, 40h block, 55h consumed, 10h borrowed, 10h approved top-up                 | Close March in borrow state. No roll-over. Expire 5 unused top-up hours. Create April period with 30h block.                                                                 |
| 8. Paused retainer            | March 2026 open period, retainer status `PAUSED`                                                   | Skipped. No ledger entries or period transition should occur.                                                                                                                |
| 9. Consulting                 | March 2026 open period, 20h block, 20h consumed, rate locked at R2,200                             | Close March. No roll-over. Create April period with 20h block.                                                                                                               |
| 10. Non-ZAR USD retainer      | March 2026 open period, 40h block, 20h consumed, locked rate 95 USD/hr                             | Close March. Roll out 10h. Create April period with 40h block and no repricing.                                                                                              |

## Roll-over and Borrow Outcomes

| Scenario                   | Rolled out | Borrow recovered into next month | Top-up expiry |
| -------------------------- | ---------: | -------------------------------: | ------------: |
| 2. Under-utilised          |        10h |                               0h |            0h |
| 3. Exactly at block        |         0h |                               0h |            0h |
| 4. Borrow-active           |         0h |                               5h |            0h |
| 5. Expired rollover bucket |        10h |                               0h |            0h |
| 7. Approved top-up         |         0h |                              10h |            5h |
| 9. Consulting              |         0h |                               0h |            0h |
| 10. USD locked FX          |        10h |                               0h |            0h |

## Rolled-Out Hours Generated

All rolled-out buckets would be earned from `2026-03-01T00:00:00.000Z` and, under the current implementation, expire 90 days later on `2026-05-30T00:00:00.000Z`.

| Scenario                   | New rolled-out bucket                          |
| -------------------------- | ---------------------------------------------- |
| 2. Under-utilised          | 10h, earn month March 2026, expires 2026-05-30 |
| 5. Expired rollover bucket | 10h, earn month March 2026, expires 2026-05-30 |
| 10. USD locked FX          | 10h, earn month March 2026, expires 2026-05-30 |

## Expiring Buckets and Top-Ups

- Scenario 5 has one existing rollover bucket in the local DB:
  - Bucket `cmo8d7rtx001pv87zca2i77bb`
  - `6h` remaining
  - Earn month `2026-01-01`
  - Expired at `2026-02-28T00:00:00.000Z`
- Scenario 7 has one approved top-up of `10h` at base rate `R1,700`, with `5h` identified by the dry-run as unused and due to expire at month-end.

Note: the dry-run response does not currently enumerate bucket-level expiry entries. The bucket detail above comes from seeded DB inspection, while the top-up expiry comes directly from the dry-run response.

## Skipped Retainers

- Scenario 1 skipped because it only has a current-month open period.
- Scenario 6 skipped because it only has a current-month open period.
- Scenario 8 skipped because the retainer status is `PAUSED`.
- No `ENDED` seed retainer exists in this dataset.

## Sanity Checks

### Rounding behaviour

Passed.

- Scenario 4 block size = `40h`
- Borrow cap = `floor(40 × 0.25) = 10h`
- Borrow used = `5h`
- Next month block = `40 - 5 = 35h`

### FIFO consumption

Passed.

Verified separately on Scenario 6 in the acceptance run:

- Oldest-expiry bucket contributed `5h`
- Newer bucket contributed `3h`
- Current-month block contributed `0h`

See [phase-b-acceptance-walkthrough.md](/Users/jarrudvandermerwe/Work/03 Projects/Muloo-DeplyOS/docs/phase-b-acceptance-walkthrough.md).

### Borrow and roll-over exclusivity

Passed.

Scenario 4 ends in borrow and the dry-run reports:

- `endedInBorrow = true`
- `rolledOutHours = 0`

### Paused retainer skip

Passed.

Scenario 8 is absent from the dry-run `actions` array and remains untouched.

### Consulting rate

Passed.

Scenario 9 remains on a flat `R2,200` rate. No banded discount path was applied.

### FX lock

Passed with one limitation.

Scenario 10 retains its locked `95 USD` rate through reconciliation. No re-price occurred. This seed path did not generate a USD top-up quote, so the locked-FX top-up path was not exercised in the dry-run itself.

## Notes for Jarrud

- The reconciliation dry-run is now observed end to end on seeded data.
- The current dry-run payload is good for period-close decisions, but it does not expose bucket-level expiry rows. I had to supplement Scenario 5 from direct DB inspection to make the audit summary complete.
