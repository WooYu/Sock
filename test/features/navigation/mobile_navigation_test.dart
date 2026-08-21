import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('phone account menu opens every secondary module', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.account_circle_outlined));
    await tester.pumpAndSettle();

    expect(find.text('规则回测'), findsOneWidget);
    expect(find.text('设置'), findsOneWidget);
    expect(find.text('管理后台'), findsOneWidget);

    await tester.tap(find.text('规则回测'));
    await tester.pumpAndSettle();
    expect(find.textContaining('请先登录后查看行情'), findsOneWidget);
  });
}
