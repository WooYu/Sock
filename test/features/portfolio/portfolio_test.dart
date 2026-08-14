import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/portfolio/portfolio.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';

void main() {
  test('portfolio owns an id, a name, and an independent ledger', () {
    final a = Portfolio(id: 'p1', name: '长线', ledger: PortfolioLedger(openingCash: 50000));
    final b = Portfolio(id: 'p2', name: '波段');

    a.ledger.record(
      TradeEntry.buy(
        id: 'buy-1',
        occurredAt: DateTime(2026, 8, 1),
        code: '600519',
        name: '贵州茅台',
        quantity: 10,
        price: 100,
        fee: 0,
      ),
    );

    expect(a.id, 'p1');
    expect(a.name, '长线');
    expect(a.ledger.openingCash, 50000);
    expect(a.ledger.entries, hasLength(1));
    expect(b.ledger.entries, isEmpty);
  });

  test('portfolio copyWith renames without replacing the ledger', () {
    final original = Portfolio(id: 'p1', name: '旧名');
    final renamed = original.copyWith(name: '新名');

    expect(renamed.name, '新名');
    expect(renamed.id, 'p1');
    expect(identical(renamed.ledger, original.ledger), isTrue);
  });

  test('snapshot holds an ordered portfolio list and an active id', () {
    final a = Portfolio(id: 'a', name: 'A');
    final b = Portfolio(id: 'b', name: 'B');
    final snapshot = PortfolioSnapshot(portfolios: [a, b], activeId: 'b');

    expect(snapshot.portfolios.map((p) => p.id), ['a', 'b']);
    expect(snapshot.activeId, 'b');
  });
}
