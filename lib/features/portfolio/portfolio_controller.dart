import 'dart:async';

import 'package:flutter/foundation.dart';

import 'persistent_portfolio_repository.dart';
import 'portfolio.dart';
import 'portfolio_ledger.dart';
import 'trade_import.dart';

class PortfolioController extends ChangeNotifier {
  PortfolioController({
    required Map<String, double> marketPrices,
    this.repository,
    String Function()? idFactory,
    List<Portfolio> portfolios = const [],
    String? activeId,
  }) : marketPrices = Map.of(marketPrices),
       _idFactory = idFactory ?? _defaultIdFactory {
    _portfolios.addAll(portfolios);
    _activeId = activeId ?? portfolios.firstOrNull?.id;
    if (_portfolios.isEmpty) {
      _ensureDefaultPortfolio();
    }
    _importer = TradeImportService(ledger);
  }

  final Map<String, double> marketPrices;
  final PortfolioRepository? repository;
  final String Function() _idFactory;

  final List<Portfolio> _portfolios = [];
  String? _activeId;
  late TradeImportService _importer;
  var _entrySequence = 0;
  TradeImportBatch? latestImport;

  static const _defaultPortfolioName = '默认组合';

  static String _defaultIdFactory() =>
      'portfolio-${DateTime.now().microsecondsSinceEpoch}';

  List<Portfolio> get portfolios => List.unmodifiable(_portfolios);
  String? get activeId => _activeId;

  Portfolio get activePortfolio {
    final active = _portfolios.where((p) => p.id == _activeId).firstOrNull;
    if (active != null) return active;
    if (_portfolios.isNotEmpty) return _portfolios.first;
    throw StateError('没有可用组合');
  }

  PortfolioLedger get ledger => activePortfolio.ledger;

  List<LedgerPosition> get positions => ledger.positions(marketPrices);
  double get marketValue =>
      positions.fold(0, (sum, item) => sum + item.marketValue);
  double get floatingProfit =>
      positions.fold(0, (sum, item) => sum + item.floatingProfit);
  double get totalProfit => floatingProfit + ledger.realizedProfit;

  double get totalMarketValue => _portfolios.fold(
    0,
    (sum, portfolio) =>
        sum +
        portfolio.ledger
            .positions(marketPrices)
            .fold(0, (inner, item) => inner + item.marketValue),
  );
  double get totalFloatingProfit => _portfolios.fold(
    0,
    (sum, portfolio) =>
        sum +
        portfolio.ledger
            .positions(marketPrices)
            .fold(0, (inner, item) => inner + item.floatingProfit),
  );
  double get totalRealizedProfit =>
      _portfolios.fold(0, (sum, portfolio) => sum + portfolio.ledger.realizedProfit);
  double get totalCombinedProfit => totalFloatingProfit + totalRealizedProfit;

  Future<void> load() async {
    final source = repository;
    if (source == null) return;
    final snapshot = await source.load();
    _portfolios
      ..clear()
      ..addAll(snapshot.portfolios);
    _activeId = snapshot.activeId ?? snapshot.portfolios.firstOrNull?.id;
    if (_portfolios.isEmpty) {
      _ensureDefaultPortfolio();
    } else if (_activeId == null ||
        !_portfolios.any((p) => p.id == _activeId)) {
      _activeId = _portfolios.first.id;
    }
    _importer = TradeImportService(ledger);
    _bumpEntrySequence();
    notifyListeners();
  }

  Portfolio createPortfolio(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) throw const LedgerValidationException('组合名称不能为空');
    final portfolio = Portfolio(id: _idFactory(), name: trimmed);
    _portfolios.add(portfolio);
    _activeId = portfolio.id;
    _importer = TradeImportService(ledger);
    notifyListeners();
    _save();
    return portfolio;
  }

  void renameActivePortfolio(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) throw const LedgerValidationException('组合名称不能为空');
    final index = _portfolios.indexWhere((p) => p.id == _activeId);
    _portfolios[index] = _portfolios[index].copyWith(name: trimmed);
    notifyListeners();
    _save();
  }

  void switchPortfolio(String id) {
    if (!_portfolios.any((p) => p.id == id)) {
      throw StateError('组合不存在');
    }
    if (_activeId == id) return;
    _activeId = id;
    _importer = TradeImportService(ledger);
    latestImport = null;
    notifyListeners();
  }

  void deleteActivePortfolio() {
    if (_portfolios.length <= 1) {
      throw StateError('至少保留一个组合');
    }
    final removedId = _activeId;
    _portfolios.removeWhere((p) => p.id == removedId);
    _activeId = _portfolios.first.id;
    _importer = TradeImportService(ledger);
    latestImport = null;
    notifyListeners();
    _save();
  }

  void updateMarketPrice(String code, double price) {
    if (price <= 0 || !price.isFinite) return;
    marketPrices[code] = price;
    notifyListeners();
  }

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
    return _importer.preview(
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
    latestImport = _importer.commit(preview);
    notifyListeners();
    _save();
  }

  bool undoLatestImport() {
    final undone = _importer.undoLatest();
    if (undone) {
      latestImport = null;
      notifyListeners();
      _save();
    }
    return undone;
  }

  void _ensureDefaultPortfolio() {
    final portfolio = Portfolio(id: _idFactory(), name: _defaultPortfolioName);
    _portfolios.add(portfolio);
    _activeId = portfolio.id;
  }

  void _bumpEntrySequence() {
    var max = 0;
    for (final portfolio in _portfolios) {
      for (final entry in portfolio.ledger.entries) {
        if (entry.id.startsWith('manual-')) {
          final suffix = int.tryParse(
            entry.id.substring('manual-'.length),
          );
          if (suffix != null && suffix > max) max = suffix;
        }
      }
    }
    _entrySequence = max;
  }

  void _save() {
    final source = repository;
    if (source != null) {
      unawaited(
        source.save(
          PortfolioSnapshot(portfolios: _portfolios, activeId: _activeId),
        ),
      );
    }
  }
}
