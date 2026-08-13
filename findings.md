# StockCal Findings

## Product Scope
The authoritative conversation defines eight major areas: account/sync, dashboard, stock search/analysis, professional candlestick charting, rules/prediction/backtesting, watchlists/portfolios/trades, reviews/constrained AI, and settings/admin. Automatic trading, direct broker linkage, subscriptions, and HK/US equities are out of initial scope.

## Repository Audit (2026-08-14)
- Repository contains a stock Flutter skeleton and a single large `HomeScreen` that switches static text blocks.
- Domain logic is currently in two flat files and uses fixed demo values.
- The mobile bottom bar exposes four modules plus a nonfunctional More item; three planned modules cannot be opened on phones.
- `pubspec.yaml` has no state, routing, persistence, networking, charting, or serialization dependencies.
- Existing tests establish only a basic app theme, demo calculations, service stubs, and text-level module navigation.
- Local Git commit is `56c9c27`; remote is `https://github.com/WooYu/Sock.git`.

## UX Direction
- Treat StockCal as an operational financial tool, not a marketing page.
- Desktop/tablet: persistent navigation rail plus compact workspace.
- Phone: at most five bottom destinations; secondary modules live in a More screen with explicit navigation.
- Minimum 48dp touch targets, semantic labels, dynamic text support, and no horizontal overflow at 375px.
- Use neutral surfaces with distinct gain/loss/status colors and tabular figures.

## Architecture Direction
- Feature-first folders with small domain, application, data, and presentation units.
- Repository interfaces isolate local persistence and remote APIs.
- Immutable records and calculation snapshots provide auditability.
- App state is injected so widget tests exercise real controllers and in-memory repositories.

