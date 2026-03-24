# Client Workspace And Approval Model

## Purpose

Deploy OS needs two distinct product surfaces:

- an internal Muloo workspace
- a client-facing workspace

The internal workspace is where Muloo captures discovery, shapes scope, generates documents, and plans delivery.

The client workspace is where the client contributes inputs, reviews outputs, and approves commercial scope.

This split is required because sharing internal pages directly is not enough. Clients need a safe, branded experience with access only to their own projects and documents.

Deploy OS should also recognize a third access nuance:

- an implementation `partner` may need visibility into selected downstream client accounts or projects

That partner visibility is not the same thing as treating the partner as the client.

## Core product rule

Deploy OS must treat discovery, quote, and delivery as separate but connected artifacts.

The sequence is:

1. client contributes pre-discovery inputs
2. Muloo runs structured discovery
3. discovery evidence is captured against the four canonical sessions
4. a client-facing discovery document is generated
5. a separate quote / agreement is generated from the recommended scope
6. the client approves all or part of the quoted scope
7. approved scope unlocks planning and delivery

## Discovery structure

The four canonical discovery sessions remain fixed:

1. Business & Goals
2. Current State
3. Future State Design
4. Scope & Handover

However, a canonical session is not the same thing as a single meeting.

Each session can contain multiple evidence items, for example:

- meeting transcript
- Gemini summary
- uploaded discovery doc
- Miro notes
- operator notes
- client form responses

In plain English:

> one session equals one discovery objective, not one calendar meeting

## Internal workspace responsibilities

The internal Muloo workspace should support:

- project creation and assignment
- structured discovery capture
- multiple evidence items per canonical session
- transcript and note ingestion
- AI-assisted session drafting
- project-level discovery summary
- blueprint generation
- discovery document generation
- quote generation
- planning and delivery controls

## Client workspace responsibilities

The client workspace should support:

- client login
- client-safe project list
- project detail without internal-only menus
- pre-discovery forms and homework
- discovery document review
- separate quotes / agreements view
- later: delivery board and status tracking

Where needed later, Deploy OS may also support a partner-safe workspace or partner-specific visibility rules for selected client accounts. Example: `Tusk` may need visibility into `Magnisol` and specific `EPIUSE` regional entities delivered through that relationship.

The client workspace should not expose internal-only controls such as:

- blueprint internals
- admin settings
- internal notes
- execution logs
- internal agent controls

Partner-facing visibility, if added, should also remain constrained to the downstream clients and projects explicitly linked to that partner.

## Document split

### 1. Discovery document

Purpose:

- educational and client-facing
- explains what Muloo learned
- explains the recommended future state
- explains scope, exclusions, assumptions, risks, and phased implementation approach
- can be taken away and used with Muloo or another implementation partner

This is the portable implementation plan.

### 2. Quote / agreement

Purpose:

- commercial and approval-focused
- prices the recommended scope
- supports currency, rate, and hours adjustments
- supports approval of all phases or a subset of phases
- becomes the commercial baseline once approved

This is not the same artifact as the discovery document.

## Partial approval rule

The client must be able to approve:

- the full recommended scope
- selected phases only
- selected workstreams only

This matters because discovery may recommend more than the client is ready to buy immediately.

## Recommended route model

### Internal routes

- `/projects/[id]`
- `/projects/[id]/discovery`
- `/projects/[id]/proposal`
- `/projects/[id]/quote`
- `/blueprint/[projectId]`

### Client routes

- `/client/login`
- `/client/projects`
- `/client/projects/[id]`
- `/client/projects/[id]/inputs`
- `/client/projects/[id]/discovery-document`
- `/client/projects/[id]/quotes`

## Recommended data model changes

Deploy OS should support these concepts explicitly:

- `Partner`
  - name
  - relationship type
  - notes

- `ClientGroup`
  - name
  - notes

- `PartnerClientLink`
  - partner id
  - client id
  - visibility scope
  - notes

- `ClientWorkspaceUser`
  - name
  - email
  - password or auth provider
  - client / project access

- `DiscoveryEvidence`
  - project id
  - session number
  - evidence type
  - source label
  - source url
  - content

- `ClientInputSubmission`
  - project id
  - contributor name
  - contributor email
  - session number
  - answers

- `Quote`
  - project id
  - version
  - currency
  - selected phases
  - totals
  - status

- `QuotePhase`
  - quote id
  - phase number
  - phase name
  - included
  - hours
  - rate
  - fee

## Build order

### Near term

1. support multiple evidence items per canonical discovery session
2. keep the discovery document and quote as separate routes and artifacts
3. add client workspace shell and login
4. add client pre-discovery forms per session

### Mid term

5. allow client review of discovery document inside client workspace
6. allow quote review and approval inside client workspace
7. support partial phase approval

### Later

8. unlock planning board from approved scope
9. expose client-safe delivery tracking
10. add change request flows after approved delivery begins
11. add partner-safe visibility for linked downstream clients where required
