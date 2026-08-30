import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/stock_analysis_controller.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/features/decision/decision_models.dart';
import 'package:stockcal/features/market/market_data.dart';

void main() {
  test('search and selection load a deterministic stock analysis', () async {
    final controller = StockAnalysisController(
      catalog: MemoryStockCatalog(DemoAshareData.securities),
      market: DemoAshareMarketAdapter(
        clock: () => DateTime(2026, 8, 14, 15, 15),
      ),
      analyzer: StockAnalyzer(),
    );

    await controller.search('gzmt');
    await controller.select(controller.results.single);

    expect(controller.status, StockAnalysisStatus.ready);
    expect(controller.selected?.code, '600519');
    expect(controller.snapshot?.source.state, MarketDataState.delayed);
    expect(controller.analysis?.future, hasLength(3));
    expect(controller.decision, isNotNull);
    expect(controller.errorMessage, isNull);
  });

  test(
    'failed refresh preserves last successful snapshot and exposes retry',
    () async {
      final market = _FailingAfterFirstMarket();
      final controller = StockAnalysisController(
        catalog: MemoryStockCatalog(DemoAshareData.securities),
        market: market,
        analyzer: StockAnalyzer(),
      );
      final security = DemoAshareData.securities.first;
      await controller.select(security);
      final previous = controller.snapshot;

      await controller.refresh();

      expect(controller.status, StockAnalysisStatus.error);
      expect(controller.snapshot, same(previous));
      expect(controller.canRetry, isTrue);
      expect(controller.errorMessage, contains('行情'));
    },
  );

  test('exposes WAIT when the market snapshot is stale', () async {
    final controller = StockAnalysisController(
      catalog: MemoryStockCatalog(DemoAshareData.securities),
      market: _StaleMarket(),
      analyzer: StockAnalyzer(),
    );

    await controller.select(DemoAshareData.securities.first);

    expect(controller.status, StockAnalysisStatus.ready);
    expect(controller.decision?.decision, DecisionAction.wait);
    expect(controller.decision?.reason, contains('过期'));
  });
}

class _FailingAfterFirstMarket implements AShareMarketAdapter {
  var calls = 0;

  @override
  Future<MarketSnapshot> snapshot(String code) {
    calls++;
    if (calls > 1) throw const MarketLoadException('行情服务暂时不可用');
    return DemoAshareMarketAdapter(
      clock: () => DateTime(2026, 8, 14, 15, 15),
    ).snapshot(code);
  }
}

class _StaleMarket implements AShareMarketAdapter {
  @override
  Future<MarketSnapshot> snapshot(String code) async {
    final snapshot = await DemoAshareMarketAdapter(
      clock: () => DateTime(2026, 8, 14, 15, 15),
    ).snapshot(code);
    return MarketSnapshot(
      quote: snapshot.quote,
      dailyCandles: snapshot.dailyCandles,
      source: MarketSourceInfo(
        name: snapshot.source.name,
        fetchedAt: snapshot.source.fetchedAt,
        state: MarketDataState.stale,
        isOnline: true,
      ),
    );
  }
}
