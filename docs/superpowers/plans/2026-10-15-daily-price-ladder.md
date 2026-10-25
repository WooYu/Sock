# Daily Price Ladder Implementation Plan

> Superseded quantity rule: the user subsequently clarified that every computed level should be shown. The current implementation removes count selection, truncation and grid fills, using `daily-close-levels-v2`. This completed plan records the original v1 work only; v1 snapshots remain read-only compatible. See the updated scenario design and research README for current behavior.

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in the existing cloud checkout.

**Goal:** Anchor the combined result on the latest completed, unadjusted daily close, constrain it to a single-session price band, and display 3–5 levels per side with signed percentage changes.

**Architecture:** Keep the complete 1% arithmetic-mean groups for audit. A pure ladder calculation selects valid rounded groups within the band and fills missing slots with explicitly labelled interval grid levels. Freeze the anchor, rule provenance, selected count, prices, and percentages in each new snapshot; old snapshots retain their original results.

**Tech Stack:** TypeScript, React, Vitest, Playwright; no new dependencies.

**Spec:** User request dated 2026-10-15 and the architecture above.

## Global Constraints

- Latest completed daily close only; observed intraday candles cannot move the anchor.
- Default three levels per side; selectable three, four, or five. Prices use the A-share ¥0.01 tick.
- Ordinary board rules are inferred and labelled as assumptions. Recognisable risk-warning/new-listing names and unknown codes require manual rule selection. Never assume ST universally means 5%.
- The band applies to one session after the anchor close. No compounding across future horizons; exceptions and adjusted reference prices require verification.
- Out-of-band groups are excluded, never clamped. Grid fills remain distinguishable from MA/BOLL references. Tick shortages are reported without duplicates.
- Preserve previous local changes, original notes, and saved histories. No production deployment or commits.

## Review Focus

- Missing daily data or an unknown rule cannot produce a misleading bounded ladder.
- Rounding, repeated cents, and tiny prices cannot create duplicate or out-of-band levels.
- A late quote or another stock's name cannot change the completed-daily-close anchor or inferred rule.
- Changing method/count/rule and saving/reloading must preserve the exact ladder; tampering is rejected.
- Desktop/mobile summaries must make percentages, interval fills, and the single-session scope visible.

### Task 1: Calculation and frozen metadata

Files: create `frontend/src/features/scenario/scenario-price-ladder.ts` and its test; modify scenario types, engine, ledger and ledger tests.

Interfaces: `resolveDailyPriceLimit(symbol, name?)`; `buildDailyPriceLadder(input, mergedLevels, selection)` returns a versioned ladder with anchor/band, up/down levels, excluded IDs, and issues.

- [x] Write and run failing calculation tests for bounds, count, percentages, missing data/rules, tick collisions, low prices, and risk names.
- [x] Implement pure calculation, engine integration, optional snapshot metadata, and strict reproducibility validation.
- [x] Verify targeted tests, including legacy round-trips and tampering rejection.

### Task 2: Summary and user controls

Files: modify `scenario-price-summary.tsx`, panel, CSS, research studio, panel tests, and `e2e/scenario-analysis.spec.ts`.

- [x] Write failing UI tests for default three levels, selectable five, manual limits, and read-only history.
- [x] Add signed percentages, upper/lower groups, close and band labels, rule controls, and a collapsible original-group audit.
- [x] Preserve the existing 1% merge, period loading, method choices, and history interactions.

### Task 3: Verification and documentation

- [x] Run the full unit suite, lint and production build.
- [x] Verify desktop/mobile browser flows and inspect real 603533 output independently against the saved anchor and band.
- [x] Complete one independent code review and fix supported findings.
- [x] Update usage and verification documentation; report tested behavior and limitations in Chinese.
