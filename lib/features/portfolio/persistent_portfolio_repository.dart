import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'portfolio_ledger.dart';

abstract interface class PortfolioRepository {
  Future<PortfolioLedger> load();
  Future<void> save(PortfolioLedger ledger);
}

class PersistentPortfolioRepository implements PortfolioRepository {
  static const _key = 'stockcal.portfolio.v1';

  @override
  Future<PortfolioLedger> load() async {
    final value = (await SharedPreferences.getInstance()).getString(_key);
    if (value == null) return PortfolioLedger();
    final json = jsonDecode(value) as Map<String, Object?>;
    final ledger = PortfolioLedger(
      openingCash: (json['openingCash']! as num).toDouble(),
    );
    final entries = (json['entries']! as List<Object?>).map(
      (item) => _entryFromJson(item! as Map<String, Object?>),
    );
    ledger.recordAll(entries);
    return ledger;
  }

  @override
  Future<void> save(PortfolioLedger ledger) async {
    await (await SharedPreferences.getInstance()).setString(
      _key,
      jsonEncode({
        'openingCash': ledger.openingCash,
        'entries': ledger.entries.map(_entryToJson).toList(growable: false),
      }),
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
