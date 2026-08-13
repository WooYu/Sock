import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main product surface exposes all planned modules', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());

    expect(find.text('总览'), findsWidgets);
    expect(find.text('个股分析'), findsOneWidget);
    expect(find.text('专业K线'), findsOneWidget);
    expect(find.text('规则回测'), findsOneWidget);
    expect(find.text('组合交易'), findsOneWidget);
    expect(find.text('复盘AI'), findsOneWidget);
    expect(find.text('设置后台'), findsOneWidget);
    for (final label in ['离线可用', '真实行情适配层']) {
      await tester.scrollUntilVisible(
        find.text(label),
        180,
        scrollable: find.byType(Scrollable).last,
      );
      expect(find.text(label), findsOneWidget);
    }
  });

  testWidgets(
    'module navigation switches to analysis, backtest, and review workspaces',
    (tester) async {
      await tester.pumpWidget(const StockCalApp());

      await tester.tap(find.text('个股分析'));
      await tester.pumpAndSettle();
      expect(find.text('搜索 A 股'), findsOneWidget);
      await tester.tap(find.text('贵州茅台'));
      await tester.pumpAndSettle();
      expect(find.text('命中规则'), findsOneWidget);

      await tester.tap(find.text('规则回测'));
      await tester.pumpAndSettle();
      expect(find.text('回测统计'), findsOneWidget);
      expect(find.text('最大回撤'), findsOneWidget);

      await tester.tap(find.text('复盘AI'));
      await tester.pumpAndSettle();
      expect(find.text('复盘摘要'), findsOneWidget);
      expect(find.text('AI 仅读取确定性计算结果'), findsOneWidget);
    },
  );
}
