import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets(
    'main workspace opens the interactive stock analysis on desktop',
    (tester) async {
      tester.view.physicalSize = const Size(1200, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(const StockCalApp());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('stock-search')), findsOneWidget);
      expect(find.text('登录以获取行情与 AI 分析'), findsOneWidget);
      expect(find.text('平安银行'), findsNothing);
    },
  );

  testWidgets('phone analysis destination exposes the same search workspace', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('stock-search')), findsOneWidget);
    expect(find.textContaining('代码、名称或拼音'), findsOneWidget);
  });
}
