import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';

void main() {
  group('portfolio ledger', () {
    test('buy includes fees in cost and sell realizes FIFO profit', () {
      final ledger = PortfolioLedger();
      ledger.record(
        TradeEntry.buy(
          id: 'buy-1',
          occurredAt: DateTime(2026, 8, 1),
          code: '600519',
          name: '贵州茅台',
          quantity: 100,
          price: 10,
          fee: 5,
        ),
      );
      ledger.record(
        TradeEntry.sell(
          id: 'sell-1',
          occurredAt: DateTime(2026, 8, 2),
          code: '600519',
          name: '贵州茅台',
          quantity: 40,
          price: 12,
          fee: 3,
        ),
      );

      final position = ledger.positionFor('600519', marketPrice: 11);
      expect(position.quantity, 60);
      expect(position.totalCost, closeTo(603, 0.001));
      expect(position.averageCost, closeTo(10.05, 0.001));
      expect(position.realizedProfit, closeTo(75, 0.001));
      expect(position.floatingProfit, closeTo(57, 0.001));
    });

    test('cash dividend increases realized profit and cash balance', () {
      final ledger = PortfolioLedger(openingCash: 2000);
      ledger.record(
        TradeEntry.buy(
          id: 'buy-1',
          occurredAt: DateTime(2026, 8, 1),
          code: '000001',
          name: '平安银行',
          quantity: 100,
          price: 10,
          fee: 5,
        ),
      );
      ledger.record(
        TradeEntry.dividend(
          id: 'dividend-1',
          occurredAt: DateTime(2026, 8, 10),
          code: '000001',
          name: '平安银行',
          cashAmount: 80,
        ),
      );

      expect(ledger.cashBalance, closeTo(1075, 0.001));
      expect(
        ledger.positionFor('000001', marketPrice: 10).realizedProfit,
        closeTo(80, 0.001),
      );
    });

    test('bonus shares increase quantity without changing total cost', () {
      final ledger = PortfolioLedger();
      ledger.record(
        TradeEntry.buy(
          id: 'buy-1',
          occurredAt: DateTime(2026, 8, 1),
          code: '300750',
          name: '宁德时代',
          quantity: 100,
          price: 20,
          fee: 0,
        ),
      );
      ledger.record(
        TradeEntry.bonus(
          id: 'bonus-1',
          occurredAt: DateTime(2026, 8, 12),
          code: '300750',
          name: '宁德时代',
          quantity: 20,
        ),
      );

      final position = ledger.positionFor('300750', marketPrice: 20);
      expect(position.quantity, 120);
      expect(position.totalCost, 2000);
      expect(position.averageCost, closeTo(16.6667, 0.001));
    });

    test('standalone fee reduces cash and realized profit', () {
      final ledger = PortfolioLedger(openingCash: 1000);
      ledger.record(
        TradeEntry.fee(
          id: 'fee-1',
          occurredAt: DateTime(2026, 8, 1),
          amount: 15,
          note: '账户管理费',
        ),
      );

      expect(ledger.cashBalance, 985);
      expect(ledger.realizedProfit, -15);
    });

    test('sell rejects quantity above available position', () {
      final ledger = PortfolioLedger();
      ledger.record(
        TradeEntry.buy(
          id: 'buy-1',
          occurredAt: DateTime(2026, 8, 1),
          code: '600519',
          name: '贵州茅台',
          quantity: 10,
          price: 10,
          fee: 0,
        ),
      );

      expect(
        () => ledger.record(
          TradeEntry.sell(
            id: 'sell-1',
            occurredAt: DateTime(2026, 8, 2),
            code: '600519',
            name: '贵州茅台',
            quantity: 11,
            price: 12,
            fee: 0,
          ),
        ),
        throwsA(isA<LedgerValidationException>()),
      );
      expect(ledger.entries, hasLength(1));
    });
  });
}
