import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('desktop portfolio destination opens interactive ledger', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.tap(find.text('组合交易'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('记一笔交易'), findsOneWidget);
    expect(find.byTooltip('导入交易'), findsOneWidget);
    expect(find.text('交易流水'), findsOneWidget);
  });

  testWidgets('phone portfolio destination opens the same ledger workspace', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.tap(find.text('组合'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('记一笔交易'), findsOneWidget);
    expect(find.text('持仓'), findsOneWidget);
  });
}
