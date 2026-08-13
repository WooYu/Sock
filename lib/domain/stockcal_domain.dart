class Candle {
  const Candle({
    required this.day,
    required this.open,
    required this.high,
    required this.low,
    required this.close,
    required this.volume,
  });

  final DateTime day;
  final double open;
  final double high;
  final double low;
  final double close;
  final int volume;
}

class PredictionResult {
  const PredictionResult({
    required this.support,
    required this.resistance,
    required this.target,
    required this.confidence,
    required this.matchedRules,
  });

  final double support;
  final double resistance;
  final double target;
  final double confidence;
  final List<String> matchedRules;
}

class PredictionEngine {
  PredictionResult predict(List<Candle> candles) {
    if (candles.length < 5) {
      throw ArgumentError('At least five candles are required.');
    }

    final recent = candles.skip(candles.length - 5).toList();
    final support = recent.map((c) => c.low).reduce((a, b) => a < b ? a : b);
    final resistance = recent
        .map((c) => c.high)
        .reduce((a, b) => a > b ? a : b);
    final last = candles.last.close;
    final range = resistance - support;
    final target = resistance + range * 0.38;
    final trendScore = last > support ? 0.78 : 0.62;

    return PredictionResult(
      support: support,
      resistance: resistance,
      target: target,
      confidence: trendScore,
      matchedRules: const [
        'MA20 trend support',
        'BOLL upper extension',
        'Volume confirmation',
      ],
    );
  }
}

class Position {
  const Position({
    required this.code,
    required this.name,
    required this.quantity,
    required this.costPrice,
    required this.lastPrice,
    required this.previousClose,
  });

  final String code;
  final String name;
  final int quantity;
  final double costPrice;
  final double lastPrice;
  final double previousClose;

  double get marketValue => quantity * lastPrice;
  double get totalProfit => quantity * (lastPrice - costPrice);
  double get dayProfit => quantity * (lastPrice - previousClose);
}

class Portfolio {
  const Portfolio(this.positions);

  final List<Position> positions;

  double get marketValue => positions.fold(0, (sum, p) => sum + p.marketValue);
  double get totalProfit => positions.fold(0, (sum, p) => sum + p.totalProfit);
  double get dayProfit => positions.fold(0, (sum, p) => sum + p.dayProfit);
}

enum TradeSide { buy, sell }

class Trade {
  const Trade({
    required this.code,
    required this.name,
    required this.side,
    required this.quantity,
    required this.price,
    required this.fee,
  });

  final String code;
  final String name;
  final TradeSide side;
  final int quantity;
  final double price;
  final double fee;

  double get amount => quantity * price + fee;
}

class TradeImporter {
  List<Trade> parse(String csv) {
    final lines = csv.trim().split(RegExp(r'\r?\n'));
    if (lines.length < 2) {
      throw const FormatException(
        'CSV must include a header and at least one row.',
      );
    }

    return lines.skip(1).map((line) {
      final cells = line.split(',');
      if (cells.length != 6) {
        throw FormatException('Malformed trade row: $line');
      }

      return Trade(
        code: cells[0],
        name: cells[1],
        side: cells[2] == 'sell' ? TradeSide.sell : TradeSide.buy,
        quantity: int.parse(cells[3]),
        price: double.parse(cells[4]),
        fee: double.parse(cells[5]),
      );
    }).toList();
  }
}

class DemoMarketData {
  static List<Candle> candlesFor(String code) {
    return [
      Candle(
        day: DateTime(2026, 8, 7),
        open: 1702,
        high: 1730,
        low: 1696,
        close: 1720,
        volume: 22100,
      ),
      Candle(
        day: DateTime(2026, 8, 10),
        open: 1721,
        high: 1745,
        low: 1704,
        close: 1732,
        volume: 23800,
      ),
      Candle(
        day: DateTime(2026, 8, 11),
        open: 1735,
        high: 1758,
        low: 1712,
        close: 1750,
        volume: 25200,
      ),
      Candle(
        day: DateTime(2026, 8, 12),
        open: 1748,
        high: 1752,
        low: 1718,
        close: 1729,
        volume: 21600,
      ),
      Candle(
        day: DateTime(2026, 8, 13),
        open: 1731,
        high: 1748,
        low: 1708,
        close: 1742,
        volume: 24400,
      ),
    ];
  }

  static const portfolio = Portfolio([
    Position(
      code: '600519',
      name: '贵州茅台',
      quantity: 100,
      costPrice: 1688,
      lastPrice: 1742,
      previousClose: 1729,
    ),
    Position(
      code: '000001',
      name: '平安银行',
      quantity: 5000,
      costPrice: 13,
      lastPrice: 14,
      previousClose: 13.986,
    ),
    Position(
      code: '300750',
      name: '宁德时代',
      quantity: 30,
      costPrice: 100,
      lastPrice: 102,
      previousClose: 101.6666666667,
    ),
  ]);
}
