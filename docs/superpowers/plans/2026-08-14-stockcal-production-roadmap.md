# StockCal Production Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete production StockCal client and service in independently verifiable vertical slices.

**Architecture:** A feature-first Flutter application uses injected repository contracts and local-first controllers. A Spring Boot service provides authenticated sync, market adapters, auditability, AI mediation, and administration over PostgreSQL and Redis.

**Tech Stack:** Flutter/Dart, Material 3, Spring Boot/Java, PostgreSQL, Redis, REST/JSON, Flutter tests, backend integration tests.

## Global Constraints
- AI cannot modify prices, deterministic calculations, trades, or immutable predictions.
- Phone bottom navigation contains no more than five destinations.
- All local mutations are immediately visible and queued for idempotent synchronization.
- New behavior uses a witnessed failing test before implementation.
- Automatic trading, broker linkage, subscriptions, and HK/US equities remain out of scope.

---

### Task 1: Local-First Account And Watchlist Slice

**Files:**
- Create focused account, navigation, watchlist, and persistence units under `lib/features/` and `lib/core/`.
- Create corresponding unit and widget tests under `test/`.

**Interfaces:**
- Produces an injectable session repository, watchlist repository, local sync outbox, and responsive app shell.

- [x] Write failing repository tests for session persistence, watchlist grouping/order, duplicate prevention, and queued mutations.
- [x] Run those tests and confirm failures identify missing behavior.
- [x] Implement minimal in-memory/local repository behavior.
- [x] Write failing widget tests for phone More navigation and editable watchlists.
- [x] Implement the responsive shell and watchlist interactions.
- [x] Run focused and full suites, refactor, and commit.

### Task 2: Portfolio Ledger And Import

- [x] Specify transaction invariants for buy, sell, dividend, corporate action, and fees.
- [x] Build the ledger by red-green cycles and derive cost, realized/floating P&L, and returns.
- [x] Add CSV/Excel mapping, preview, validation, atomic commit, and undo with tests.
- [x] Deliver portfolio and transaction workspaces across phone and desktop.

### Task 3: Search, Quotes, And Analysis

- [x] Define adapter contracts and fixtures for code/name/pinyin search and delayed quotes.
- [x] Add MA, EMA, BOLL, volume, support/resistance, targets, confidence, risk, and three-day extension calculations by TDD.
- [x] Add source timestamp, delay, stale, retry, and offline presentation states.

### Task 4: Professional Chart And Annotations

- [ ] Integrate a proven charting foundation and test timeframe/adjustment transformations.
- [ ] Add zoom, pan, crosshair, indicators, real/forecast separation, and landscape mode.
- [ ] Add trend, horizontal, rectangle, and point annotation create/edit/hide/delete plus sync persistence.

### Task 5: Rules, Predictions, And Backtests

- [ ] Implement versioned structured rules and immutable calculation snapshots.
- [ ] Implement prediction generation and new-version-only persistence.
- [ ] Implement backtests with hit rate, error, drawdown, and sample count.

### Task 6: Reviews And Constrained AI

- [ ] Build daily, weekly, and trade review comparisons.
- [ ] Enforce deterministic read-only AI input and audited output storage.
- [ ] Add edit and regenerate flows without mutating source facts.

### Task 7: Production Backend And Sync

- [ ] Build SMS authentication, refresh tokens, profile, and device management.
- [ ] Add PostgreSQL migrations, Redis-backed jobs, idempotent incremental sync, retries, and repair.
- [ ] Add users, roles, rule templates, data-source status, audit logs, and AI call logs.

### Task 8: Release Verification

- [ ] Run client and server suites plus static analysis and migration checks.
- [ ] Build Android and Web release artifacts.
- [ ] Verify phone/tablet/desktop visuals, keyboard/screen-reader semantics, text scaling, offline and delayed-source states.
- [ ] Audit every requirement against executable or rendered evidence, commit, and push to GitHub.
