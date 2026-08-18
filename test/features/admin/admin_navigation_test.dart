import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main workspace opens settings and administration', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.tap(find.text('更多'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('设置'));
    await tester.pumpAndSettle();

    expect(find.text('指标参数'), findsOneWidget);
    await tester.tap(find.text('管理后台'));
    await tester.pumpAndSettle();
    expect(find.text('行情源状态'), findsOneWidget);
    expect(find.textContaining('请先使用管理员账户登录'), findsOneWidget);
  });
}
