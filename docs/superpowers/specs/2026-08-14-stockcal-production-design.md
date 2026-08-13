# StockCal Production Design

## Product Promise
StockCal is a local-first A-share decision journal. It combines portfolio truth, market context, deterministic key-level calculations, immutable predictions, and post-trade review without presenting AI-generated prices as facts.

## Experience Architecture
The primary phone destinations are Overview, Markets, Chart, Portfolio, and More. More opens Rules & Backtests, Reviews & AI, Settings, and Administration. Tablet and desktop use a navigation rail and retain the same information architecture. Each screen is a real workspace with loading, empty, offline, delayed, error, and success states.

## Client Architecture
Flutter code is organized by feature. Domain models are immutable and platform-independent. Application controllers coordinate use cases. Repository contracts isolate local and remote data. Local persistence accepts writes immediately and appends idempotent synchronization operations. Remote adapters expose source timestamps and delay status.

## Data And Auditability
Predictions store an immutable input snapshot, matched rule versions, calculation trace, output levels, confidence, and creation time. Re-running creates a new version. Trades capture quote and prediction references plus the user's reason. AI receives only deterministic snapshots and produces editable prose; it has no write path to quotes, trades, calculations, or prediction outputs.

## Backend Boundary
The production backend is Spring Boot with PostgreSQL and Redis. It owns SMS credentials, market-source credentials, AI credentials, authentication, authorization, incremental synchronization, audit logs, job status, retries, and repair operations. The Flutter client never embeds service secrets.

## Visual System
Use Material 3 with compact operational density, 4/8dp spacing, radii no larger than 8dp, neutral surfaces, and semantic gain/loss/warning/source colors. Numbers use tabular alignment. Interactive targets are at least 48dp. Navigation never exceeds five phone tabs. Charts include legends and textual summaries and never communicate state by color alone.

## Failure Behavior
Offline mutations remain visible with pending status. Sync failures show cause and retry. Quote failures retain the last known timestamp and never masquerade as live data. Import validates rows before committing and supports undo. Destructive account and data actions require confirmation. Prediction and audit history cannot be overwritten.

## Verification Strategy
Every behavior is introduced by a failing unit, widget, integration, or contract test. Release verification includes all Flutter tests, static analysis, Android and Web release builds, responsive screenshots at phone/tablet/desktop widths, accessibility semantics, offline behavior, backend integration tests, migration checks, and a requirement-by-requirement completion audit.

