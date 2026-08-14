import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/portfolio/portfolio_controller.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';
import 'package:stockcal/features/portfolio/persistent_portfolio_repository.dart';

void main() {
  test(
    'live market price updates portfolio valuation and notifies listeners',
    () {
      final ledger = PortfolioLedger();
      ledger.record(
        TradeEntry.buy(
          id: 'buy-1',
          occurredAt: DateTime(2026, 8, 14),
          code: '600519',
          name: '贵州茅台',
          quantity: 100,
          price: 1500,
          fee: 0,
        ),
      );
      final controller = PortfolioController(ledger: ledger, marketPrices: {});
      var notifications = 0;
      controller.addListener(() => notifications += 1);

      controller.updateMarketPrice('600519', 1700);

      expect(controller.marketValue, 170000);
      expect(controller.floatingProfit, 20000);
      expect(notifications, 1);
    },
  );

  test('load restores opening cash as well as ledger entries', () async {
    final restored = PortfolioLedger(openingCash: 100000)
      ..record(
        TradeEntry.buy(
          id: 'buy-1',
          occurredAt: DateTime(2026, 8, 14),
          code: '000001',
          name: '平安银行',
          quantity: 100,
          price: 10,
          fee: 0,
        ),
      );
    final controller = PortfolioController(
      ledger: PortfolioLedger(),
      marketPrices: const {},
      repository: _FixedPortfolioRepository(restored),
    );

    await controller.load();

    expect(controller.ledger.openingCash, 100000);
    expect(controller.ledger.entries.single.id, 'buy-1');
    expect(controller.ledger.cashBalance, 99000);
  });
}

class _FixedPortfolioRepository implements PortfolioRepository {
  _FixedPortfolioRepository(this.value);
  final PortfolioLedger value;

  @override
  Future<PortfolioLedger> load() async => value;

  @override
  Future<void> save(PortfolioLedger ledger) async {}
}
