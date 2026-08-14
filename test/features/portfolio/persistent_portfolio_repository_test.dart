import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/portfolio/persistent_portfolio_repository.dart';
import 'package:stockcal/features/portfolio/portfolio.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';

void main() {
  test('multiple portfolios and the active id survive recreation', () async {
    SharedPreferences.setMockInitialValues({});
    final repository = PersistentPortfolioRepository();

    final longTerm = Portfolio(
      id: 'p-long',
      name: '长线',
      ledger: PortfolioLedger(openingCash: 100000)
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
        ),
    );
    final swing = Portfolio(
      id: 'p-swing',
      name: '波段',
      ledger: PortfolioLedger(openingCash: 20000),
    );

    await repository.save(
      PortfolioSnapshot(portfolios: [longTerm, swing], activeId: 'p-swing'),
    );
    final restored = await repository.load();

    expect(restored.portfolios.map((p) => p.id), ['p-long', 'p-swing']);
    expect(restored.portfolios.map((p) => p.name), ['长线', '波段']);
    expect(restored.activeId, 'p-swing');
    expect(restored.portfolios.first.ledger.openingCash, 100000);
    expect(restored.portfolios.first.ledger.entries.single.id, 'b1');
    expect(restored.portfolios.first.ledger.cashBalance, 100000 - 10 * 100 - 5);
  });

  test('legacy single-ledger data migrates to a default portfolio', () async {
    SharedPreferences.setMockInitialValues({
      'stockcal.portfolio.v1': jsonEncode({
        'openingCash': 50000,
        'entries': [
          {
            'id': 'legacy-1',
            'occurredAt': '2026-08-01T00:00:00.000',
            'type': 'buy',
            'code': '000001',
            'name': '平安银行',
            'quantity': 100,
            'price': 10,
            'feeAmount': 0,
            'cashAmount': 0,
            'note': null,
            'batchId': null,
          },
        ],
      }),
    });
    final repository = PersistentPortfolioRepository();

    final restored = await repository.load();

    expect(restored.portfolios, hasLength(1));
    expect(restored.portfolios.single.name, '默认组合');
    expect(restored.portfolios.single.ledger.openingCash, 50000);
    expect(restored.portfolios.single.ledger.entries.single.id, 'legacy-1');
    expect(restored.activeId, restored.portfolios.single.id);
  });
}
