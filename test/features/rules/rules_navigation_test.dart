import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main workspace opens interactive versioned rules', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.tap(find.text('规则回测'));
    await tester.pumpAndSettle();

    expect(find.text('规则版本'), findsOneWidget);
    expect(find.text('不可变预测'), findsOneWidget);
    expect(find.text('回测统计'), findsOneWidget);
    expect(find.byTooltip('新建规则'), findsOneWidget);
  });
}
