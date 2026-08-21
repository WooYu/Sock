enum TradeEntryType { buy, sell, dividend, bonus, fee }

class TradeEntry {
  const TradeEntry._({
    required this.id,
    required this.occurredAt,
    required this.type,
    this.code,
    this.name,
    this.quantity = 0,
    this.price = 0,
    this.feeAmount = 0,
    this.cashAmount = 0,
    this.note,
    this.batchId,
  });

  factory TradeEntry.buy({
    required String id,
    required DateTime occurredAt,
    required String code,
    required String name,
    required int quantity,
    required double price,
    required double fee,
    String? batchId,
  }) => TradeEntry._(
    id: id,
    occurredAt: occurredAt,
    type: TradeEntryType.buy,
    code: code,
    name: name,
    quantity: quantity,
    price: price,
    feeAmount: fee,
    batchId: batchId,
  );

  factory TradeEntry.sell({
    required String id,
    required DateTime occurredAt,
    required String code,
    required String name,
    required int quantity,
    required double price,
    required double fee,
    String? batchId,
  }) => TradeEntry._(
    id: id,
    occurredAt: occurredAt,
    type: TradeEntryType.sell,
    code: code,
    name: name,
    quantity: quantity,
    price: price,
    feeAmount: fee,
    batchId: batchId,
  );

  factory TradeEntry.dividend({
    required String id,
    required DateTime occurredAt,
    required String code,
    required String name,
    required double cashAmount,
    String? batchId,
  }) => TradeEntry._(
    id: id,
    occurredAt: occurredAt,
    type: TradeEntryType.dividend,
    code: code,
    name: name,
    cashAmount: cashAmount,
    batchId: batchId,
  );

  factory TradeEntry.bonus({
    required String id,
    required DateTime occurredAt,
    required String code,
    required String name,
    required int quantity,
    String? batchId,
  }) => TradeEntry._(
    id: id,
    occurredAt: occurredAt,
    type: TradeEntryType.bonus,
    code: code,
    name: name,
    quantity: quantity,
    batchId: batchId,
  );

  factory TradeEntry.fee({
    required String id,
    required DateTime occurredAt,
    required double amount,
    required String note,
    String? batchId,
  }) => TradeEntry._(
    id: id,
    occurredAt: occurredAt,
    type: TradeEntryType.fee,
    feeAmount: amount,
    note: note,
    batchId: batchId,
  );

  final String id;
  final DateTime occurredAt;
  final TradeEntryType type;
  final String? code;
  final String? name;
  final int quantity;
  final double price;
  final double feeAmount;
  final double cashAmount;
  final String? note;
  final String? batchId;

  TradeEntry withBatchId(String value) => TradeEntry._(
    id: id,
    occurredAt: occurredAt,
    type: type,
    code: code,
    name: name,
    quantity: quantity,
    price: price,
    feeAmount: feeAmount,
    cashAmount: cashAmount,
    note: note,
    batchId: value,
  );
}

class LedgerPosition {
  const LedgerPosition({
    required this.code,
    required this.name,
    required this.quantity,
    required this.totalCost,
    required this.realizedProfit,
    required this.marketPrice,
  });

  final String code;
  final String name;
  final int quantity;
  final double totalCost;
  final double realizedProfit;
  final double marketPrice;

  double get averageCost => quantity == 0 ? 0 : totalCost / quantity;
  double get marketValue => quantity * marketPrice;
  double get floatingProfit => marketValue - totalCost;
}

class RealizedProfitPoint {
  const RealizedProfitPoint({
    required this.occurredAt,
    required this.cumulativeProfit,
  });

  final DateTime occurredAt;
  final double cumulativeProfit;
}

class LedgerValidationException implements Exception {
  const LedgerValidationException(this.message);

  final String message;

  @override
  String toString() => message;
}

class PortfolioLedger {
  PortfolioLedger({this.openingCash = 0});

  final double openingCash;
  final List<TradeEntry> _entries = [];

  List<TradeEntry> get entries => List.unmodifiable(_entries);

  void record(TradeEntry entry) {
    _validateEntry(entry);
    if (_entries.any((item) => item.id == entry.id)) {
      throw const LedgerValidationException('交易记录编号不能重复');
    }
    if (entry.type == TradeEntryType.sell) {
      final available = _stateFor(entry.code!).quantity;
      if (entry.quantity > available) {
        throw LedgerValidationException(
          '卖出数量 ${entry.quantity} 超过可用持仓 $available',
        );
      }
    }
    if (entry.type == TradeEntryType.bonus &&
        _stateFor(entry.code!).quantity == 0) {
      throw const LedgerValidationException('无持仓时不能登记送转股份');
    }
    _entries.add(entry);
  }

  void recordAll(Iterable<TradeEntry> entries) {
    final originalLength = _entries.length;
    try {
      for (final entry in entries) {
        record(entry);
      }
    } catch (_) {
      _entries.removeRange(originalLength, _entries.length);
      rethrow;
    }
  }

  void removeBatch(String batchId) {
    _entries.removeWhere((entry) => entry.batchId == batchId);
  }

  double get cashBalance {
    var cash = openingCash;
    for (final entry in _entries) {
      switch (entry.type) {
        case TradeEntryType.buy:
          cash -= entry.quantity * entry.price + entry.feeAmount;
        case TradeEntryType.sell:
          cash += entry.quantity * entry.price - entry.feeAmount;
        case TradeEntryType.dividend:
          cash += entry.cashAmount;
        case TradeEntryType.bonus:
          break;
        case TradeEntryType.fee:
          cash -= entry.feeAmount;
      }
    }
    return cash;
  }

  double get realizedProfit {
    final codes = _entries
        .map((entry) => entry.code)
        .whereType<String>()
        .toSet();
    var total = codes.fold<double>(
      0,
      (sum, code) => sum + _stateFor(code).realizedProfit,
    );
    total -= _entries
        .where((entry) => entry.type == TradeEntryType.fee)
        .fold<double>(0, (sum, entry) => sum + entry.feeAmount);
    return total;
  }

  LedgerPosition positionFor(String code, {required double marketPrice}) {
    final state = _stateFor(code);
    return LedgerPosition(
      code: code,
      name: state.name,
      quantity: state.quantity,
      totalCost: state.totalCost,
      realizedProfit: state.realizedProfit,
      marketPrice: marketPrice,
    );
  }

  List<LedgerPosition> positions(Map<String, double> marketPrices) {
    final codes = _entries
        .where((entry) => entry.code != null)
        .map((entry) => entry.code!)
        .toSet();
    return codes
        .map((code) => positionFor(code, marketPrice: marketPrices[code] ?? 0))
        .where((position) => position.quantity > 0)
        .toList();
  }

  /// 按时间顺序重放交易，得到累计已实现盈亏曲线。
  List<RealizedProfitPoint> realizedProfitSeries() {
    final sorted = List<TradeEntry>.of(_entries)
      ..sort((a, b) => a.occurredAt.compareTo(b.occurredAt));
    final states = <String, _PositionState>{};
    var cumulative = 0.0;
    final points = <RealizedProfitPoint>[];
    for (final entry in sorted) {
      if (entry.type == TradeEntryType.fee) {
        cumulative -= entry.feeAmount;
        points.add(
          RealizedProfitPoint(
            occurredAt: entry.occurredAt,
            cumulativeProfit: cumulative,
          ),
        );
        continue;
      }
      final code = entry.code;
      if (code == null) continue;
      final prev = states[code] ??
          _PositionState(
            name: entry.name ?? code,
            quantity: 0,
            totalCost: 0,
            realizedProfit: 0,
          );
      final next = _applyEntry(prev, entry);
      cumulative += next.realizedProfit - prev.realizedProfit;
      states[code] = next;
      points.add(
        RealizedProfitPoint(
          occurredAt: entry.occurredAt,
          cumulativeProfit: cumulative,
        ),
      );
    }
    return points;
  }

  _PositionState _applyEntry(_PositionState state, TradeEntry entry) {
    var quantity = state.quantity;
    var totalCost = state.totalCost;
    var realizedProfit = state.realizedProfit;
    switch (entry.type) {
      case TradeEntryType.buy:
        quantity += entry.quantity;
        totalCost += entry.quantity * entry.price + entry.feeAmount;
      case TradeEntryType.sell:
        final averageCost = quantity == 0 ? 0 : totalCost / quantity;
        final releasedCost = averageCost * entry.quantity;
        quantity -= entry.quantity;
        totalCost -= releasedCost;
        realizedProfit +=
            entry.quantity * entry.price - entry.feeAmount - releasedCost;
      case TradeEntryType.dividend:
        realizedProfit += entry.cashAmount;
      case TradeEntryType.bonus:
        quantity += entry.quantity;
      case TradeEntryType.fee:
        break;
    }
    return _PositionState(
      name: state.name,
      quantity: quantity,
      totalCost: totalCost,
      realizedProfit: realizedProfit,
    );
  }

  _PositionState _stateFor(String code) {
    var state = _PositionState(
      name: code,
      quantity: 0,
      totalCost: 0,
      realizedProfit: 0,
    );
    for (final entry in _entries.where((item) => item.code == code)) {
      final name = entry.name ?? state.name;
      final applied = _applyEntry(state, entry);
      state = _PositionState(
        name: name,
        quantity: applied.quantity,
        totalCost: applied.totalCost,
        realizedProfit: applied.realizedProfit,
      );
    }
    return state;
  }

  void _validateEntry(TradeEntry entry) {
    if (entry.id.trim().isEmpty) {
      throw const LedgerValidationException('交易记录编号不能为空');
    }
    if (entry.quantity < 0 ||
        entry.price < 0 ||
        entry.feeAmount < 0 ||
        entry.cashAmount < 0) {
      throw const LedgerValidationException('数量和金额不能为负数');
    }
    if ((entry.type == TradeEntryType.buy ||
            entry.type == TradeEntryType.sell ||
            entry.type == TradeEntryType.bonus) &&
        entry.quantity == 0) {
      throw const LedgerValidationException('交易数量必须大于零');
    }
    if ((entry.type == TradeEntryType.buy ||
            entry.type == TradeEntryType.sell) &&
        entry.price == 0) {
      throw const LedgerValidationException('成交价格必须大于零');
    }
    if (entry.type == TradeEntryType.dividend && entry.cashAmount == 0) {
      throw const LedgerValidationException('分红金额必须大于零');
    }
    if (entry.type == TradeEntryType.fee && entry.feeAmount == 0) {
      throw const LedgerValidationException('费用金额必须大于零');
    }
  }
}

class _PositionState {
  const _PositionState({
    required this.name,
    required this.quantity,
    required this.totalCost,
    required this.realizedProfit,
  });

  final String name;
  final int quantity;
  final double totalCost;
  final double realizedProfit;
}
