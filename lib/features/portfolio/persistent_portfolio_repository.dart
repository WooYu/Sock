import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'portfolio.dart';
import 'portfolio_ledger.dart';

abstract interface class PortfolioRepository {
  Future<PortfolioSnapshot> load();
  Future<void> save(PortfolioSnapshot snapshot);
}

class PersistentPortfolioRepository implements PortfolioRepository {
  static const _key = 'stockcal.portfolio.v2';
  static const _legacyKey = 'stockcal.portfolio.v1';
  static const _defaultName = '默认组合';

  @override
  Future<PortfolioSnapshot> load() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_key);
    if (raw != null) {
      return _snapshotFromJson(jsonDecode(raw) as Map<String, Object?>);
    }
    final legacy = preferences.getString(_legacyKey);
    if (legacy != null) {
      return _migrateLegacy(jsonDecode(legacy) as Map<String, Object?>);
    }
    return const PortfolioSnapshot(portfolios: [], activeId: null);
  }

  @override
  Future<void> save(PortfolioSnapshot snapshot) async {
    await (await SharedPreferences.getInstance()).setString(
      _key,
      jsonEncode({
        'activeId': snapshot.activeId,
        'portfolios': snapshot.portfolios
            .map(_portfolioToJson)
            .toList(growable: false),
      }),
    );
  }

  PortfolioSnapshot _snapshotFromJson(Map<String, Object?> json) {
    final portfolios = (json['portfolios']! as List<Object?>)
        .map((item) => _portfolioFromJson(item! as Map<String, Object?>))
        .toList(growable: false);
    return PortfolioSnapshot(
      portfolios: portfolios,
      activeId: json['activeId'] as String?,
    );
  }

  PortfolioSnapshot _migrateLegacy(Map<String, Object?> json) {
    final ledger = PortfolioLedger(
      openingCash: (json['openingCash']! as num).toDouble(),
    );
    final entries = (json['entries']! as List<Object?>).map(
      (item) => _entryFromJson(item! as Map<String, Object?>),
    );
    ledger.recordAll(entries);
    final portfolio = Portfolio(
      id: 'portfolio-default',
      name: _defaultName,
      ledger: ledger,
    );
    return PortfolioSnapshot(portfolios: [portfolio], activeId: portfolio.id);
  }

  Map<String, Object?> _portfolioToJson(Portfolio portfolio) => {
    'id': portfolio.id,
    'name': portfolio.name,
    'openingCash': portfolio.ledger.openingCash,
    'entries': portfolio.ledger.entries
        .map(_entryToJson)
        .toList(growable: false),
  };

  Portfolio _portfolioFromJson(Map<String, Object?> json) {
    final ledger = PortfolioLedger(
      openingCash: (json['openingCash']! as num).toDouble(),
    );
    final entries = (json['entries']! as List<Object?>).map(
      (item) => _entryFromJson(item! as Map<String, Object?>),
    );
    ledger.recordAll(entries);
    return Portfolio(
      id: json['id']! as String,
      name: json['name']! as String,
      ledger: ledger,
    );
  }

  Map<String, Object?> _entryToJson(TradeEntry entry) => {
    'id': entry.id,
    'occurredAt': entry.occurredAt.toIso8601String(),
    'type': entry.type.name,
    'code': entry.code,
    'name': entry.name,
    'quantity': entry.quantity,
    'price': entry.price,
    'feeAmount': entry.feeAmount,
    'cashAmount': entry.cashAmount,
    'note': entry.note,
    'batchId': entry.batchId,
  };

  TradeEntry _entryFromJson(Map<String, Object?> json) {
    final type = TradeEntryType.values.byName(json['type']! as String);
    final id = json['id']! as String;
    final occurredAt = DateTime.parse(json['occurredAt']! as String);
    final code = json['code'] as String?;
    final name = json['name'] as String?;
    final quantity = json['quantity']! as int;
    final price = (json['price']! as num).toDouble();
    final fee = (json['feeAmount']! as num).toDouble();
    final cash = (json['cashAmount']! as num).toDouble();
    final batchId = json['batchId'] as String?;
    return switch (type) {
      TradeEntryType.buy => TradeEntry.buy(
        id: id,
        occurredAt: occurredAt,
        code: code!,
        name: name!,
        quantity: quantity,
        price: price,
        fee: fee,
        batchId: batchId,
      ),
      TradeEntryType.sell => TradeEntry.sell(
        id: id,
        occurredAt: occurredAt,
        code: code!,
        name: name!,
        quantity: quantity,
        price: price,
        fee: fee,
        batchId: batchId,
      ),
      TradeEntryType.dividend => TradeEntry.dividend(
        id: id,
        occurredAt: occurredAt,
        code: code!,
        name: name!,
        cashAmount: cash,
        batchId: batchId,
      ),
      TradeEntryType.bonus => TradeEntry.bonus(
        id: id,
        occurredAt: occurredAt,
        code: code!,
        name: name!,
        quantity: quantity,
        batchId: batchId,
      ),
      TradeEntryType.fee => TradeEntry.fee(
        id: id,
        occurredAt: occurredAt,
        amount: fee,
        note: json['note']! as String,
        batchId: batchId,
      ),
    };
  }
}
