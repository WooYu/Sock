# Note Tags Interaction Implementation Plan

> Execute directly in this session with superpowers:executing-plans; use test-driven-development for persistent behavior.

**Goal:** Complete the note-tag browsing and definition-editing flow approved by the user.
**Architecture:** Add optional, versioned forecast definitions to NoteTagRecord. Keep human definition readiness independent from source-derived executable roles and validation. Use a focused editor component and preserve the existing tag store and shared sync payload.
**Tech Stack:** React, Next.js, TypeScript, Vitest, Playwright.
**Spec:** ../specs/2026-10-25-note-tags-interaction-design.md

## Global Constraints

Preserve source evidence, existing versions, export and shared sync. No automatic validation or execution from human definitions. Old records must remain readable.

## Review Focus

Malformed persisted definitions; incomplete drafts; stale edit conflicts; hidden selected records after paging/filtering; keyboard and mobile modal accessibility.

## Task 1: Versioned definition model

Files: note-tags.ts, new note-forecast-definitions.ts and tests.
- [ ] Write and run failing tests for old ledger compatibility, draft/ready validation, immutable revision, tag review preservation, malformed definitions.
- [ ] Add ForecastDefinition with role, condition, timeframe, scope, invalidation, openQuestions and draft/ready state. Implement reviseForecastDefinition(previous, definition, reason, createdAt) and validate optional definitions during ledger parsing.
- [ ] Run targeted tests; preserve optional definitions through existing tag revisions/export/sync.

## Task 2: Definition cards and editor

Files: new note-forecast-definition-editor.tsx; note-tag-workbench.tsx/css; component tests.
- [ ] Write failing tests for opening a role-specific editor, saving a draft, completing a definition, read-only history, cancel and retained input on failure.
- [ ] Render separate role cards with definition readiness, linked compiled rules and collapsed source quotations. Add focused dialog with validation, dirty-close confirmation and save feedback.
- [ ] Integrate the existing persist guard and version history without clearing browsing context after save.

## Task 3: Browsing feedback

Files: note-tag-workbench.tsx/css and tests.
- [ ] Test paging selects an item on the visible page and saving retains the filters.
- [ ] Add expandable advanced filters, removable active-filter chips, empty-state reset and explicit label-only review help.
- [ ] Run model/component tests, TypeScript/lint; verify desktop/mobile in Playwright with independent storage and no production writes.
- [ ] Review the complete diff, commit task changes and push where connectivity permits.
