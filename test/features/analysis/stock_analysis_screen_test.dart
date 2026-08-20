import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/stock_analysis_controller.dart';
import 'package:stockcal/features/analysis/stock_analysis_screen.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/features/market/market_data.dart';
import 'package:stockcal/features/knowledge/knowledge.dart';

void main() {
  testWidgets(
    'searches by pinyin and renders quote, levels, indicators, rules, and extension',
    (tester) async {
      final controller = StockAnalysisController(
        catalog: MemoryStockCatalog(DemoAshareData.securities),
        market: DemoAshareMarketAdapter(
          clock: () => DateTime(2026, 8, 14, 15, 15),
        ),
        analyzer: StockAnalyzer(),
      );
      await tester.pumpWidget(
        MaterialApp(home: StockAnalysisScreen(controller: controller)),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('stock-search')), 'gzmt');
      await tester.pumpAndSettle();
      await tester.tap(find.text('贵州茅台'));
      await tester.pumpAndSettle();

      expect(find.text('600519 · SH'), findsOneWidget);
      expect(find.textContaining('延迟行情'), findsOneWidget);
      expect(find.text('支撑位'), findsOneWidget);
      expect(find.text('压力位'), findsOneWidget);
      expect(find.text('目标位'), findsOneWidget);
      expect(find.textContaining('MA5 '), findsWidgets);
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Text && (widget.data?.startsWith('EMA12 ') ?? false),
        ),
        findsOneWidget,
      );
      expect(find.text('盈利模式识别'), findsOneWidget);
      expect(find.text('未来三日指标延伸'), findsOneWidget);
    },
  );

  testWidgets('renders without horizontal overflow on a small phone', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = StockAnalysisController(
      catalog: MemoryStockCatalog(DemoAshareData.securities),
      market: DemoAshareMarketAdapter(
        clock: () => DateTime(2026, 8, 14, 15, 15),
      ),
      analyzer: StockAnalyzer(),
    );
    await controller.select(DemoAshareData.securities.first);

    await tester.pumpWidget(
      MaterialApp(home: StockAnalysisScreen(controller: controller)),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('未来三日指标延伸'), findsOneWidget);
  });

  testWidgets('shows only approved experience and concept knowledge', (
    tester,
  ) async {
    final knowledge = KnowledgeController(
      MemoryKnowledgeRepository(
        sources: const [
          KnowledgeSource(
            id: 's1',
            title: '海龟',
            path: '股票/海龟.md',
            originalContent: '海龟只做两天。',
          ),
        ],
        drafts: const [
          KnowledgeDraft(
            id: 'k1',
            sourceId: 's1',
            kind: KnowledgeKind.experience,
            title: '持有周期',
            summary: '海龟通常只做两天',
            excerpt: '海龟只做两天。',
            sourceLine: 1,
            status: ApprovalStatus.approved,
            extractionMethod: ExtractionMethod.ai,
          ),
        ],
      ),
    );
    await knowledge.load();
    final controller = StockAnalysisController(
      catalog: MemoryStockCatalog(DemoAshareData.securities),
      market: DemoAshareMarketAdapter(
        clock: () => DateTime(2026, 8, 14, 15, 15),
      ),
      analyzer: StockAnalyzer(),
    );
    await controller.select(DemoAshareData.securities.first);

    await tester.pumpWidget(
      MaterialApp(
        home: StockAnalysisScreen(
          controller: controller,
          knowledgeController: knowledge,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('相关经验与概念'), findsOneWidget);
    expect(find.text('海龟通常只做两天'), findsOneWidget);
    expect(find.textContaining('海龟 · 第 1 行'), findsOneWidget);
  });
}
