# Muloo Deploy

Muloo Deploy is a private internal HubSpot provisioning engine for Muloo delivery operations. This first vertical slice is intentionally dry-run only and compares a validated onboarding spec against existing HubSpot contact properties.

## What is included

- `pnpm` workspace monorepo scaffold
- CLI entrypoint
- typed shared packages for schema, config, HubSpot access, diffing, execution, and file output
- dry-run artifact persistence under `artifacts/`
- sample onboarding spec in `specs/examples/`

## Guardrails

- Dry run is the only supported execution mode in this phase
- Any attempt to enable destructive actions is rejected during config load
- No HubSpot mutations are implemented

## Setup

1. Use Node.js 18.18+.
2. Install dependencies:

```bash
corepack pnpm install
```

3. Copy `.env.example` to `.env` and provide a HubSpot private app token.

## Usage

Run the CLI against the sample spec:

```bash
corepack pnpm cli -- --spec specs/examples/contact-properties.json
```

You can also pass the spec path positionally:

```bash
corepack pnpm cli -- specs/examples/contact-properties.json
```

## Output

The CLI:

- validates the onboarding spec with Zod
- loads runtime config from `.env` and process env
- fetches existing HubSpot contact properties
- compares desired vs existing properties
- prints a human-readable dry-run summary
- writes a machine-readable artifact JSON file to `artifacts/`

See `docs/architecture.md` for the package-level layout.
