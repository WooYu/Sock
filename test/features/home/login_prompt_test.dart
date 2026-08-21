import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('shows login prompt when signed out', (tester) async {
    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    expect(find.text('登录以获取行情与 AI 分析'), findsOneWidget);
    expect(find.text('去登录'), findsOneWidget);
  });

  testWidgets('account menu shows logout only when signed in', (tester) async {
    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.account_circle_outlined));
    await tester.pumpAndSettle();

    expect(find.text('账户同步'), findsOneWidget);
    expect(find.text('退出登录'), findsNothing);
  });
}
