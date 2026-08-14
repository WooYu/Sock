import 'dart:async';

import 'package:flutter/foundation.dart';

import 'persistent_portfolio_repository.dart';
import 'portfolio_ledger.dart';
import 'trade_import.dart';

class PortfolioController extends ChangeNotifier {
  PortfolioController({
    required this.ledger,
    required this.marketPrices,
    this.repository,
  }) : importer = TradeImportService(ledger);

  final PortfolioLedger ledger;
  final Map<String, double> marketPrices;
  final PortfolioRepository? repository;
  final TradeImportService importer;
  var _entrySequence = 0;
  TradeImportBatch? latestImport;

  Future<void> load() async {
    final source = repository;
    if (source == null || ledger.entries.isNotEmpty) return;
    final restored = await source.load();
    ledger.recordAll(restored.entries);
    _entrySequence = ledger.entries.length;
    notifyListeners();
  }

  List<LedgerPosition> get positions => ledger.positions(marketPrices);
  double get marketValue =>
      positions.fold(0, (sum, item) => sum + item.marketValue);
  double get floatingProfit =>
      positions.fold(0, (sum, item) => sum + item.floatingProfit);
  double get totalProfit => floatingProfit + ledger.realizedProfit;

  void record({
    required TradeEntryType type,
    required String code,
    required String name,
    required int quantity,
    required double price,
    required double fee,
    required double cashAmount,
    required String note,
  }) {
    final id = 'manual-${++_entrySequence}';
    final now = DateTime.now();
    final entry = switch (type) {
      TradeEntryType.buy => TradeEntry.buy(
        id: id,
        occurredAt: now,
        code: code,
        name: name,
        quantity: quantity,
        price: price,
        fee: fee,
      ),
      TradeEntryType.sell => TradeEntry.sell(
        id: id,
        occurredAt: now,
        code: code,
        name: name,
        quantity: quantity,
        price: price,
        fee: fee,
      ),
      TradeEntryType.dividend => TradeEntry.dividend(
        id: id,
        occurredAt: now,
        code: code,
        name: name,
        cashAmount: cashAmount,
      ),
      TradeEntryType.bonus => TradeEntry.bonus(
        id: id,
        occurredAt: now,
        code: code,
        name: name,
        quantity: quantity,
      ),
      TradeEntryType.fee => TradeEntry.fee(
        id: id,
        occurredAt: now,
        amount: fee,
        note: note,
      ),
    };
    ledger.record(entry);
    notifyListeners();
    _save();
  }

  TradeImportPreview previewSampleImport() {
    return importer.preview(
      rows: const [
        {
          '流水号': 'sample-buy',
          '日期': '2026-08-01',
          '业务': '买入',
          '证券代码': '000001',
          '证券名称': '平安银行',
          '数量': '100',
          '价格': '12.5',
          '费用': '5',
          '发生金额': '',
          '备注': '导入样例',
        },
        {
          '流水号': 'sample-dividend',
          '日期': '2026-08-10',
          '业务': '分红',
          '证券代码': '000001',
          '证券名称': '平安银行',
          '数量': '',
          '价格': '',
          '费用': '',
          '发生金额': '20',
          '备注': '',
        },
      ],
      mapping: const TradeColumnMapping(
        id: '流水号',
        occurredAt: '日期',
        type: '业务',
        code: '证券代码',
        name: '证券名称',
        quantity: '数量',
        price: '价格',
        fee: '费用',
        cashAmount: '发生金额',
        note: '备注',
      ),
    );
  }

  void commitImport(TradeImportPreview preview) {
    latestImport = importer.commit(preview);
    notifyListeners();
    _save();
  }

  bool undoLatestImport() {
    final undone = importer.undoLatest();
    if (undone) {
      latestImport = null;
      notifyListeners();
      _save();
    }
    return undone;
  }

  void _save() {
    final source = repository;
    if (source != null) unawaited(source.save(ledger));
  }
}
