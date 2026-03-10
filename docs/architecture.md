# Architecture Notes

## Scope

This repository currently implements only the first dry-run vertical slice for HubSpot contact property comparison. It does not apply changes.

## Package responsibilities

- `apps/cli`: command-line orchestration and human-readable output
- `packages/core`: domain schema, shared types, structured logger, summary formatting
- `packages/config`: environment loading and guardrail validation
- `packages/file-system`: JSON input loading and artifact persistence
- `packages/hubspot-client`: typed HubSpot service layer for CRM property reads
- `packages/diff-engine`: deterministic property comparison logic
- `packages/executor`: dry-run workflow orchestration

## Flow

1. The CLI resolves the spec path and rejects any live/apply flags.
2. Config is loaded from `.env` plus process env and validated with Zod.
3. The onboarding spec JSON is loaded from disk and validated with Zod.
4. The executor fetches current HubSpot contact properties.
5. The diff engine groups desired properties into:
   - unchanged
   - needs creation
   - needs review
6. The executor writes a JSON artifact to `artifacts/`.
7. The CLI prints a concise summary for operators.

## Design choices

- Dry-run enforcement happens in config and executor layers, not only in the CLI.
- HubSpot calls are isolated behind a service class to keep future write paths contained.
- The diff logic compares a small normalized property shape to avoid noisy output.
- Artifact output is a stable JSON structure intended for later automation, auditing, and testing.
