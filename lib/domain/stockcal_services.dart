enum SyncStatus { pending, synced, failed }

class SyncOperation {
  SyncOperation(this.type, this.payload, {this.status = SyncStatus.pending});

  final String type;
  final Map<String, Object?> payload;
  SyncStatus status;
}

class SyncQueue {
  final List<SyncOperation> _operations = [];

  List<SyncOperation> get snapshot => List.unmodifiable(_operations);
  int get pendingCount =>
      _operations.where((op) => op.status == SyncStatus.pending).length;
  int get failedCount =>
      _operations.where((op) => op.status == SyncStatus.failed).length;

  void enqueue(SyncOperation operation) {
    _operations.add(operation);
  }

  void markFailed(String type) {
    for (final operation in _operations.where((op) => op.type == type)) {
      operation.status = SyncStatus.failed;
    }
  }

  void retryFailed() {
    for (final operation in _operations.where(
      (op) => op.status == SyncStatus.failed,
    )) {
      operation.status = SyncStatus.pending;
    }
  }
}

class MarketQuote {
  const MarketQuote({
    required this.code,
    required this.name,
    required this.price,
    required this.changePercent,
    required this.delayMinutes,
    required this.sourceName,
  });

  final String code;
  final String name;
  final double price;
  final double changePercent;
  final int delayMinutes;
  final String sourceName;

  bool get isRealtime => delayMinutes == 0;
}

class DemoMarketAdapter {
  MarketQuote quote(String code) {
    if (code == '600519') {
      return const MarketQuote(
        code: '600519',
        name: '贵州茅台',
        price: 1742,
        changePercent: 0.75,
        delayMinutes: 15,
        sourceName: 'Demo A-share adapter',
      );
    }

    return MarketQuote(
      code: code,
      name: '样例股票',
      price: 12.21,
      changePercent: 0.42,
      delayMinutes: 15,
      sourceName: 'Demo A-share adapter',
    );
  }
}

class ReviewAssistant {
  String summarize({
    required String symbol,
    required double support,
    required double resistance,
    required double actualClose,
  }) {
    final location = actualClose >= resistance
        ? '收盘突破压力位'
        : actualClose <= support
        ? '收盘跌破支撑位'
        : '收盘仍在关键区间内';

    return '$symbol $location，支撑 ${support.toStringAsFixed(0)}，压力 '
        '${resistance.toStringAsFixed(0)}。AI 仅读取确定性计算结果，不修改任何价格。';
  }
}
