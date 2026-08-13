import 'portfolio_ledger.dart';

class TradeColumnMapping {
  const TradeColumnMapping({
    required this.id,
    required this.occurredAt,
    required this.type,
    required this.code,
    required this.name,
    required this.quantity,
    required this.price,
    required this.fee,
    required this.cashAmount,
    required this.note,
  });

  final String id;
  final String occurredAt;
  final String type;
  final String code;
  final String name;
  final String quantity;
  final String price;
  final String fee;
  final String cashAmount;
  final String note;
}

class TradeImportError {
  const TradeImportError({required this.rowNumber, required this.message});

  final int rowNumber;
  final String message;
}

class TradeImportPreview {
  const TradeImportPreview({required this.entries, required this.errors});

  final List<TradeEntry> entries;
  final List<TradeImportError> errors;

  bool get isValid => errors.isEmpty && entries.isNotEmpty;
}

class TradeImportBatch {
  const TradeImportBatch({required this.id, required this.entryCount});

  final String id;
  final int entryCount;
}

class TradeImportException implements Exception {
  const TradeImportException(this.message);

  final String message;

  @override
  String toString() => message;
}

class TradeImportService {
  TradeImportService(this._ledger);

  final PortfolioLedger _ledger;
  final List<TradeImportBatch> _history = [];
  var _batchSequence = 0;

  TradeImportPreview preview({
    required List<Map<String, String>> rows,
    required TradeColumnMapping mapping,
  }) {
    final entries = <TradeEntry>[];
    final errors = <TradeImportError>[];
    for (var index = 0; index < rows.length; index++) {
      try {
        entries.add(_parseRow(rows[index], mapping));
      } on FormatException catch (error) {
        errors.add(
          TradeImportError(rowNumber: index + 2, message: error.message),
        );
      }
    }
    return TradeImportPreview(
      entries: List.unmodifiable(entries),
      errors: List.unmodifiable(errors),
    );
  }

  TradeImportBatch commit(TradeImportPreview preview) {
    if (!preview.isValid) {
      throw const TradeImportException('导入预览存在错误，不能提交');
    }
    final batchId = 'import-${++_batchSequence}';
    final entries = preview.entries
        .map((entry) => entry.withBatchId(batchId))
        .toList();
    _ledger.recordAll(entries);
    final batch = TradeImportBatch(id: batchId, entryCount: entries.length);
    _history.add(batch);
    return batch;
  }

  bool undoLatest() {
    if (_history.isEmpty) return false;
    final batch = _history.removeLast();
    _ledger.removeBatch(batch.id);
    return true;
  }

  TradeEntry _parseRow(Map<String, String> row, TradeColumnMapping mapping) {
    final id = _required(row, mapping.id, '流水号');
    final occurredAt = _date(row[mapping.occurredAt], '日期');
    final type = _required(row, mapping.type, '业务类型');
    final code = (row[mapping.code] ?? '').trim();
    final name = (row[mapping.name] ?? '').trim();
    final note = (row[mapping.note] ?? '').trim();
    final quantity = _integer(row[mapping.quantity], '数量');
    final price = _number(row[mapping.price], '价格');
    final fee = _number(row[mapping.fee], '费用');
    final cashAmount = _number(row[mapping.cashAmount], '发生金额');

    return switch (type) {
      '买入' => TradeEntry.buy(
        id: id,
        occurredAt: occurredAt,
        code: _notBlank(code, '证券代码'),
        name: _notBlank(name, '证券名称'),
        quantity: _positiveInt(quantity, '数量'),
        price: _positiveDouble(price, '价格'),
        fee: fee,
      ),
      '卖出' => TradeEntry.sell(
        id: id,
        occurredAt: occurredAt,
        code: _notBlank(code, '证券代码'),
        name: _notBlank(name, '证券名称'),
        quantity: _positiveInt(quantity, '数量'),
        price: _positiveDouble(price, '价格'),
        fee: fee,
      ),
      '分红' => TradeEntry.dividend(
        id: id,
        occurredAt: occurredAt,
        code: _notBlank(code, '证券代码'),
        name: _notBlank(name, '证券名称'),
        cashAmount: _positiveDouble(cashAmount, '发生金额'),
      ),
      '送转' => TradeEntry.bonus(
        id: id,
        occurredAt: occurredAt,
        code: _notBlank(code, '证券代码'),
        name: _notBlank(name, '证券名称'),
        quantity: _positiveInt(quantity, '数量'),
      ),
      '费用' => TradeEntry.fee(
        id: id,
        occurredAt: occurredAt,
        amount: _positiveDouble(fee, '费用'),
        note: _notBlank(note, '备注'),
      ),
      _ => throw FormatException('不支持的业务类型：$type'),
    };
  }

  String _required(Map<String, String> row, String column, String label) {
    return _notBlank((row[column] ?? '').trim(), label);
  }

  String _notBlank(String value, String label) {
    if (value.isEmpty) throw FormatException('$label不能为空');
    return value;
  }

  DateTime _date(String? raw, String label) {
    final value = raw?.trim() ?? '';
    final date = DateTime.tryParse(value);
    if (date == null) throw FormatException('$label格式错误：$value');
    return date;
  }

  int _integer(String? raw, String label) {
    final value = raw?.trim() ?? '';
    if (value.isEmpty) return 0;
    final parsed = int.tryParse(value);
    if (parsed == null) throw FormatException('$label必须是整数：$value');
    return parsed;
  }

  double _number(String? raw, String label) {
    final value = raw?.trim() ?? '';
    if (value.isEmpty) return 0;
    final parsed = double.tryParse(value);
    if (parsed == null) throw FormatException('$label必须是数字：$value');
    return parsed;
  }

  int _positiveInt(int value, String label) {
    if (value <= 0) throw FormatException('$label必须大于零');
    return value;
  }

  double _positiveDouble(double value, String label) {
    if (value <= 0) throw FormatException('$label必须大于零');
    return value;
  }
}
