import 'package:candlesticks/candlesticks.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main workspace opens the chart and preserves annotations', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.tap(find.text('专业K线'));
    await tester.pumpAndSettle();

    expect(find.byType(Candlesticks), findsOneWidget);
    expect(find.text('标注管理'), findsOneWidget);
    await tester.tap(find.byTooltip('趋势线'));
    await tester.pumpAndSettle();
    expect(find.text('趋势线 1'), findsOneWidget);

    await tester.tap(find.text('总览'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('专业K线'));
    await tester.pumpAndSettle();
    expect(find.text('趋势线 1'), findsOneWidget);
  });
}
