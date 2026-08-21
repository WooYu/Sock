import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main product surface exposes the reference destinations', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    expect(find.text('组合总览'), findsWidgets);
    expect(find.text('关键位分析'), findsOneWidget);
    expect(find.text('盈利模式'), findsOneWidget);
    expect(find.text('未来指标'), findsOneWidget);
    expect(find.text('预测记录'), findsOneWidget);
    expect(find.text('交易与盈亏'), findsOneWidget);
    expect(find.text('统计图表'), findsOneWidget);
    expect(find.text('当日复盘'), findsOneWidget);
    expect(find.text('AI策略'), findsOneWidget);
    expect(find.text('经验规则'), findsOneWidget);
  });

  testWidgets('module navigation switches to backtest and review workspaces', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    expect(find.text('登录以获取行情与 AI 分析'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.account_circle_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.text('规则回测'));
    await tester.pumpAndSettle();
    expect(find.textContaining('请先登录后查看行情'), findsOneWidget);

    await tester.tap(find.text('当日复盘'));
    await tester.pumpAndSettle();
    expect(find.text('暂无复盘记录'), findsOneWidget);
    expect(find.text('请先在组合交易中记录买卖'), findsOneWidget);
  });
}
