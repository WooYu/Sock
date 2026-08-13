# StockCal Product Delivery Plan

## Goal
Deliver the complete Flutter StockCal product described in the referenced conversation: account and local-first sync, portfolio dashboard, A-share analysis, professional charts and annotations, rules/predictions/backtests, watchlists/trades/import, reviews/AI explanations, settings/admin, and verified mobile/Web builds.

## Current State
- Flutter product workspaces and deterministic domain services cover the planned client scope.
- Local-first queues, editable workflows, account/device state, backend contracts, and administration views exist.
- Flutter has prior Web release-build evidence; backend dependency verification and repository push remain network-dependent.

## Phases
| Phase | Status | Exit evidence |
|---|---|---|
| 1. Requirements, architecture, and durable planning | complete | Design, roadmap, findings, and progress files created |
| 2. Local-first account, navigation, and watchlist vertical slice | complete | Account/watchlist integrated in desktop and mobile navigation; login, logout, token rotation, device revoke, sync and narrow-layout tests pass |
| 3. Portfolio, transaction ledger, import, and P&L | complete | 14 new domain/widget/integration tests; 32-test full suite and clean analyze |
| 4. Quote/search adapters and stock analysis | complete | 17 new tests; 49-test full suite and clean static analysis |
| 5. Professional K-line and annotation editor | complete | 19 chart domain/controller/widget/navigation tests, 68-test suite, clean analyze, Web release build |
| 6. Rules, immutable predictions, and backtesting | complete | 15 domain/widget/navigation tests, 83-test full suite, clean analyze |
| 7. Review and constrained AI explanation | complete | 9 domain/widget/navigation tests, 92-test full suite, clean analyze |
| 8. Backend services, auth, sync, and administration | in_progress | API/integration tests, PostgreSQL/Redis deployment verification |
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
| Portfolio widget test expected compact data fragments as standalone widgets | 3 | Inspected rendered matches and tightened assertions to exact user-visible rows; production UI remained unchanged |
| Full analyze found an unused direct import in portfolio screen | 1 | Screen consumes import behavior through its controller; removed the redundant import |
| Standalone stock analysis screen lacked a Material ancestor | 1 | Stack trace showed TextField boundary assumption; screen now owns a transparent Material surface |
| Legacy product test expected rules before selecting a stock | 1 | Updated test to follow the explicit search/selection workflow; no implicit demo selection restored |
| `agent-reach` and `mcporter` commands absent from PATH | 2 | Followed skill fallback chain, then used built-in web search restricted to pub.dev and official package documentation |
| `agent-browser` CLI and in-app browser runtime absent | 2 | Verified desktop/phone/landscape through widget layout and canvas tests; defer screenshot capture to release hardening |
| Spring Boot Gradle plugin could not resolve through dead `127.0.0.1:10808` proxy or direct network | 2 | Keep backend test/spec files; continue Flutter admin and API contracts, retry dependency-backed integration later |
