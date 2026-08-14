import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main workspace does not present demo chart data before login', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.tap(find.text('专业K线'));
    await tester.pumpAndSettle();

    expect(find.textContaining('请先登录后查看行情'), findsOneWidget);
    expect(find.text('标注管理'), findsNothing);
  });
}
