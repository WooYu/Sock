import 'package:flutter/foundation.dart';

import '../decision/decision_models.dart';
import '../market/market_data.dart';
import 'technical_analysis.dart';

enum StockAnalysisStatus { idle, searching, loading, ready, error }

class StockAnalysisController extends ChangeNotifier {
  StockAnalysisController({
    required this.catalog,
    required this.market,
    required this.analyzer,
  });

  final StockCatalog catalog;
  final AShareMarketAdapter market;
  final StockAnalyzer analyzer;

  StockAnalysisStatus status = StockAnalysisStatus.idle;
  OperationCycle cycle = OperationCycle.swing;
  List<Security> results = [];
  Security? selected;
  MarketSnapshot? snapshot;
  StockAnalysis? analysis;
  DecisionResult? decision;
  String? errorMessage;

  bool get canRetry => selected != null && status == StockAnalysisStatus.error;

  Future<void> setCycle(OperationCycle value) async {
    if (value == cycle) return;
    cycle = value;
    if (selected != null) await _load();
  }

  Future<void> initialize() => search('');

  Future<void> search(String query) async {
    status = StockAnalysisStatus.searching;
    errorMessage = null;
    notifyListeners();
    try {
      results = await catalog.search(query);
      status = snapshot == null
          ? StockAnalysisStatus.idle
          : StockAnalysisStatus.ready;
    } catch (error) {
      status = StockAnalysisStatus.error;
      errorMessage = '搜索失败：$error';
    }
    notifyListeners();
  }

  Future<void> select(Security security) async {
    selected = security;
    await _load();
  }

  Future<void> refresh() async {
    if (selected == null) return;
    await _load();
  }

  Future<void> _load() async {
    status = StockAnalysisStatus.loading;
    errorMessage = null;
    notifyListeners();
    try {
      final loaded = await market.snapshot(selected!.code);
      snapshot = loaded;
      final dataFresh = switch (loaded.source.state) {
        MarketDataState.realtime || MarketDataState.delayed => true,
        MarketDataState.stale || MarketDataState.offlineCache => false,
      };
      try {
        final calculated = analyzer.analyze(
          loaded.dailyCandles,
          lookback: cycle.lookback,
          dataFresh: dataFresh,
        );
        analysis = calculated;
        decision = calculated.decision;
      } on AnalysisException catch (error) {
        analysis = null;
        decision = DecisionResult(
          decision: DecisionAction.wait,
          reason: '分析条件不完整，等待更多历史行情：${error.message}',
          missingFacts: [error.message],
          generatedAt: DateTime.now(),
        );
      }
      status = StockAnalysisStatus.ready;
    } on MarketLoadException catch (error) {
      status = StockAnalysisStatus.error;
      errorMessage = error.message;
    } catch (error) {
      status = StockAnalysisStatus.error;
      errorMessage = '行情加载失败：$error';
    }
    notifyListeners();
  }
}
