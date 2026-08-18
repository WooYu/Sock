import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('home screen presents the phase one calculation shell', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());

    expect(find.text('StockCal'), findsOneWidget);
    expect(find.text('贵州茅台接近压力区'), findsNothing);
    expect(find.text('加载真实行情后显示关键位提醒'), findsOneWidget);
    expect(find.text('持仓与自选'), findsOneWidget);
    expect(find.text('行情待连接'), findsOneWidget);
    for (final label in ['关键位提醒', '最新预测', '待复盘']) {
      await tester.scrollUntilVisible(
        find.text(label),
        180,
        scrollable: find.byType(Scrollable).last,
      );
      expect(find.text(label), findsOneWidget);
    }
  });

  testWidgets('desktop navigation opens watchlist and account workspaces', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());

    await tester.tap(find.text('更多'));
    await tester.pumpAndSettle();
    expect(find.text('自选股'), findsOneWidget);
    expect(find.text('账户与同步'), findsOneWidget);

    await tester.tap(find.text('自选股'));
    await tester.pumpAndSettle();
    expect(find.text('还没有自选分组'), findsOneWidget);

    await tester.tap(find.text('更多'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('账户与同步'));
    await tester.pumpAndSettle();
    expect(find.text('手机验证码登录'), findsOneWidget);
  });

  testWidgets('desktop navigation opens the knowledge approval workspace', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());

    await tester.tap(find.text('更多'));
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

    await tester.tap(find.text('个股分析'));
    await tester.pumpAndSettle();

    expect(find.textContaining('请先登录后查看行情'), findsOneWidget);
    expect(find.text('StockCal 演示行情'), findsNothing);
  });
}
