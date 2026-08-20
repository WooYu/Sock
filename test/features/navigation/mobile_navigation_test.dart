import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('phone My destination opens every secondary module', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.tap(find.text('我的'));
    await tester.pumpAndSettle();

    expect(find.text('规则回测'), findsOneWidget);
    expect(find.text('复盘 AI'), findsOneWidget);
    expect(find.text('设置'), findsOneWidget);
    expect(find.text('管理后台'), findsOneWidget);

    await tester.tap(find.text('复盘 AI'));
    await tester.pumpAndSettle();
    expect(find.text('暂无复盘记录'), findsOneWidget);
  });
}
