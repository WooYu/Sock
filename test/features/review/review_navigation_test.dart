import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main workspace opens interactive review and AI evidence', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.tap(find.text('复盘AI'));
    await tester.pumpAndSettle();

    expect(find.text('交易复盘'), findsOneWidget);
    expect(find.text('计划与执行'), findsOneWidget);
    expect(find.text('生成摘要'), findsOneWidget);
    expect(find.text('AI 仅读取确定性计算结果'), findsOneWidget);
  });
}
