import 'package:candlesticks/candlesticks.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart' as domain;
import 'package:stockcal/features/chart/chart_data.dart';
import 'package:stockcal/features/chart/chart_annotations.dart';
import 'package:stockcal/features/chart/professional_chart_screen.dart';

void main() {
  testWidgets(
    'renders chart with timeframe, adjustment, and forecast boundary',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: ProfessionalChartScreen(candles: _candles())),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(Candlesticks), findsOneWidget);
      expect(find.text('日线'), findsOneWidget);
      expect(find.text('周线'), findsOneWidget);
      expect(find.text('月线'), findsOneWidget);
      expect(find.text('不复权'), findsOneWidget);
      expect(find.text('真实行情'), findsOneWidget);
      expect(find.text('预测区'), findsOneWidget);
      expect(find.text('MA5'), findsOneWidget);
      expect(find.text('MA20'), findsOneWidget);
      expect(find.text('EMA12'), findsOneWidget);
      expect(find.text('BOLL'), findsOneWidget);
      expect(find.byKey(const Key('indicator-canvas')), findsOneWidget);
    },
  );

  testWidgets('switches timeframe and adjustment mode', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ProfessionalChartScreen(candles: _candles())),
      ),
    );

    await tester.tap(find.text('周线'));
    await tester.pump();
    final timeframeControl = tester.widget<SegmentedButton<ChartTimeframe>>(
      find.byType(SegmentedButton<ChartTimeframe>),
    );
    expect(timeframeControl.selected, {ChartTimeframe.weekly});

    await tester.tap(find.text('不复权'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('前复权').last);
    await tester.pumpAndSettle();
    expect(find.text('前复权'), findsOneWidget);
  });

  testWidgets('toggles indicator layers without changing candle data', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ProfessionalChartScreen(candles: _candles())),
      ),
    );
    final before = tester
        .widget<Candlesticks>(find.byType(Candlesticks))
        .candles;

    await tester.tap(find.text('MA5'));
    await tester.pump();

    final control = tester.widget<FilterChip>(
      find.widgetWithText(FilterChip, 'MA5'),
    );
    final after = tester
        .widget<Candlesticks>(find.byType(Candlesticks))
        .candles;
    expect(control.selected, isFalse);
    expect(
      after.map((item) => item.date),
      orderedEquals(before.map((item) => item.date)),
    );
    expect(
      after.map((item) => item.close),
      orderedEquals(before.map((item) => item.close)),
    );
  });

  testWidgets('desktop tools create, hide, and delete an annotation', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = _annotationController();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProfessionalChartScreen(
            stockCode: '600519',
            candles: _candles(),
            annotationController: controller,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('趋势线'));
    await tester.pumpAndSettle();
    expect(controller.annotations, hasLength(1));
    expect(find.text('趋势线 1'), findsOneWidget);

    await tester.tap(find.byTooltip('隐藏标注'));
    await tester.pumpAndSettle();
    expect(controller.annotations.single.hidden, isTrue);

    await tester.tap(find.byTooltip('删除标注'));
    await tester.pumpAndSettle();
    expect(controller.annotations, isEmpty);
  });

  testWidgets(
    'phone exposes drawing tools from a bottom sheet without overflow',
    (tester) async {
      tester.view.physicalSize = const Size(375, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final controller = _annotationController();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProfessionalChartScreen(
              stockCode: '600519',
              candles: _candles(),
              annotationController: controller,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('绘图工具'));
      await tester.pumpAndSettle();
      expect(find.text('绘图与标注'), findsOneWidget);
      await tester.tap(find.text('水平线'));
      await tester.pumpAndSettle();
      expect(
        controller.annotations.single.type,
        ChartAnnotationType.horizontalLine,
      );
      expect(tester.takeException(), isNull);
    },
  );
}

ChartAnnotationController _annotationController() {
  var id = 0;
  return ChartAnnotationController(
    stockCode: '600519',
    repository: MemoryChartAnnotationRepository(),
    outbox: MemoryChartAnnotationOutbox(),
    idFactory: () => 'annotation-${++id}',
    clock: () => DateTime(2026, 8, 14),
  );
}

List<domain.Candle> _candles() {
  return List.generate(20, (index) {
    final price = 10.0 + index;
    return domain.Candle(
      day: DateTime(2026, 7, 1).add(Duration(days: index)),
      open: price,
      high: price + 2,
      low: price - 1,
      close: price + 1,
      volume: 1000 + index * 10,
    );
  });
}
