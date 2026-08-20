import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('desktop navigation opens watchlist and account workspaces', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text('自选'));
    await tester.pumpAndSettle();
    expect(find.text('还没有自选分组'), findsOneWidget);

    await tester.tap(find.text('我的'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('账户同步'));
    await tester.pumpAndSettle();
    expect(find.text('A 股决策日志 · 手机号登录'), findsOneWidget);
  });

  testWidgets('desktop navigation opens the knowledge approval workspace', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text('我的'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('知识规则'));
    await tester.pumpAndSettle();

    expect(find.text('待审批 0'), findsOneWidget);
    expect(find.text('经验概念'), findsOneWidget);
    expect(find.text('原文'), findsOneWidget);
  });

  testWidgets('production market workspace requires backend login', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    expect(find.text('登录以获取行情与 AI 分析'), findsOneWidget);
    expect(find.text('StockCal 演示行情'), findsNothing);
  });
}
