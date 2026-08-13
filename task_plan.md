# StockCal Product Delivery Plan

## Goal
Deliver the complete Flutter StockCal product described in the referenced conversation: account and local-first sync, portfolio dashboard, A-share analysis, professional charts and annotations, rules/predictions/backtests, watchlists/trades/import, reviews/AI explanations, settings/admin, and verified mobile/Web builds.

## Current State
- Flutter shell and deterministic demo domain exist.
- Ten automated tests passed in the previous session.
- No production persistence, API, authentication, real quote source, editable workflows, or release build evidence exists yet.

## Phases
| Phase | Status | Exit evidence |
|---|---|---|
| 1. Requirements, architecture, and durable planning | complete | Design, roadmap, findings, and progress files created |
| 2. Local-first account, navigation, and watchlist vertical slice | in_progress | Red/green tests, persistence abstraction, usable responsive flow |
| 3. Portfolio, transaction ledger, import, and P&L | pending | Domain and widget tests plus complete CRUD/import/undo flow |
| 4. Quote/search adapters and stock analysis | pending | Contract tests, delayed-source states, indicators and key levels |
| 5. Professional K-line and annotation editor | pending | Gesture/drawing tests and desktop/mobile visual verification |
| 6. Rules, immutable predictions, and backtesting | pending | Versioning and deterministic calculation tests |
| 7. Review and constrained AI explanation | pending | Deterministic input boundary, edit/regenerate flows, audit evidence |
| 8. Backend services, auth, sync, and administration | pending | API/integration tests, PostgreSQL/Redis deployment verification |
| 9. Release hardening and delivery | pending | Full test suite, analyze, Android/Web builds, visual/accessibility QA, pushed repository |

## Decisions
- Flutter remains the single client codebase for Android, iOS, and Web.
- UI is a quiet, dense financial workspace: semantic colors, 4/8dp rhythm, no decorative gradients, bottom navigation limited to five primary destinations, secondary modules in a More screen.
- Domain calculations remain deterministic. AI may explain immutable calculation snapshots but cannot write market values or prediction outputs.
- Local writes are immediate and queued for idempotent server synchronization.
- Every new behavior follows red-green-refactor TDD.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| UI/UX design-system script path missing | 1 | Located skill package and discovered `scripts` is a pointer file |
| Pointer resolves to absent `C:\Users\Administrator\src\ui-ux-pro-max` | 2 | Use the fully read skill guidance directly; do not repeat the broken command |
| GitHub push could not reach proxy `127.0.0.1` | 1 | Keep commits local and retry after checking current proxy/network state |
| Flutter Web and Windows builds timed out | 1 | Retry after feature work with bounded diagnostics and platform-specific build checks |
| Watchlist dialog used a disposed text controller during exit animation | 1 | Reproduced in widget test; replaced controller ownership with dialog-scoped value capture |
