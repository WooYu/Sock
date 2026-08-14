import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/portfolio/persistent_portfolio_repository.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';

void main() {
  test('portfolio cash and every ledger entry survive recreation', () async {
    SharedPreferences.setMockInitialValues({});
    final ledger = PortfolioLedger(openingCash: 100000)
      ..record(
        TradeEntry.buy(
          id: 'b1',
          occurredAt: DateTime.utc(2026, 8, 1),
          code: '600519',
          name: '贵州茅台',
          quantity: 10,
          price: 100,
          fee: 5,
        ),
      )
      ..record(
        TradeEntry.dividend(
          id: 'd1',
          occurredAt: DateTime.utc(2026, 8, 2),
          code: '600519',
          name: '贵州茅台',
          cashAmount: 20,
        ),
      );

    await PersistentPortfolioRepository().save(ledger);
    final restored = await PersistentPortfolioRepository().load();

    expect(restored.openingCash, 100000);
    expect(restored.entries.map((entry) => entry.id), ['b1', 'd1']);
    expect(restored.cashBalance, ledger.cashBalance);
  });
}
