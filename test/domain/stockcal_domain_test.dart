import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart';

void main() {
  test('prediction engine derives levels and confidence from candles', () {
    final candles = DemoMarketData.candlesFor('600519');

    final result = PredictionEngine().predict(candles);

    expect(result.support, closeTo(1696, 1));
    expect(result.resistance, closeTo(1758, 1));
    expect(result.target, greaterThan(result.resistance));
    expect(result.confidence, inInclusiveRange(0.70, 0.95));
    expect(result.matchedRules, contains('MA20 trend support'));
  });

  test('portfolio calculates market value and total profit', () {
    final portfolio = DemoMarketData.portfolio;

    expect(portfolio.marketValue, closeTo(247260, 1));
    expect(portfolio.totalProfit, closeTo(10460, 1));
    expect(portfolio.dayProfit, closeTo(1380, 1));
  });

  test('importer parses csv trades and rejects malformed rows', () {
    const csv =
        'code,name,side,quantity,price,fee\n'
        '600519,贵州茅台,buy,100,1688,8\n'
        '000001,平安银行,sell,500,12.5,5\n';

    final trades = TradeImporter().parse(csv);

    expect(trades, hasLength(2));
    expect(trades.first.amount, 168808);
    expect(
      () => TradeImporter().parse('code,name,side,quantity,price,fee\nbad'),
      throwsA(isA<FormatException>()),
    );
  });
}
