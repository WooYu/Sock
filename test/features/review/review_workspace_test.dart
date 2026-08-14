import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/review/persistent_review_store.dart';
import 'package:stockcal/features/review/review_workspace.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';

void main() {
  testWidgets('persistent workspace stays empty when no reviews exist', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final store = PersistentReviewStore();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ReviewWorkspace(store: store)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('暂无复盘记录'), findsOneWidget);
    expect(await store.tradeReviews(), isEmpty);
    expect(find.text('600519'), findsNothing);
  });

  testWidgets('creates a review from an immutable trade record', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final store = PersistentReviewStore();
    final trade = TradeEntry.buy(
      id: 'trade-1',
      occurredAt: DateTime(2026, 8, 14, 10),
      code: '000001',
      name: '平安银行',
      quantity: 100,
      price: 12.5,
      fee: 5,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ReviewWorkspace(store: store, trades: [trade]),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('从交易创建复盘'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, '计划价'), '12.20');
    await tester.enterText(find.widgetWithText(TextFormField, '实际收盘'), '12.80');
    await tester.enterText(find.widgetWithText(TextFormField, '预测版本'), '1');
    await tester.enterText(find.widgetWithText(TextFormField, '预测目标'), '13.00');
    await tester.enterText(
      find.widgetWithText(TextFormField, '执行理由'),
      '突破后回踩确认',
    );
    await tester.tap(find.text('保存复盘'));
    await tester.pumpAndSettle();

    expect(find.text('计划与执行'), findsOneWidget);
    expect(find.text('12.20'), findsOneWidget);
    expect((await store.tradeReviews()).single.tradeId, 'trade-1');
  });

  testWidgets('shows trade comparison and daily weekly summaries', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ReviewWorkspace())),
    );
    await tester.pumpAndSettle();

    expect(find.text('计划与执行'), findsOneWidget);
    expect(find.text('计划价'), findsOneWidget);
    expect(find.text('实际成交'), findsOneWidget);
    expect(find.text('预测与实际走势'), findsOneWidget);
    expect(find.text('失效原因'), findsOneWidget);
    expect(find.text('日复盘'), findsOneWidget);
    await tester.tap(find.text('周复盘'));
    await tester.pumpAndSettle();
    expect(find.textContaining('本周交易'), findsOneWidget);
  });

  testWidgets('generates regenerates and edits narrative text', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ReviewWorkspace())),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('生成摘要'));
    await tester.pumpAndSettle();
    expect(find.text('文案版本 1'), findsOneWidget);
    expect(find.textContaining('计划价'), findsWidgets);

    await tester.tap(find.byTooltip('重新生成'));
    await tester.pumpAndSettle();
    expect(find.text('文案版本 2'), findsOneWidget);

    await tester.tap(find.byTooltip('编辑摘要'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), '严格执行止损，等待量能确认。');
    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();
    expect(find.text('文案版本 3'), findsOneWidget);
    expect(find.text('严格执行止损，等待量能确认。'), findsOneWidget);
  });

  testWidgets('phone layout has no horizontal overflow', (tester) async {
    tester.view.physicalSize = const Size(375, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ReviewWorkspace())),
    );
    await tester.pumpAndSettle();

    expect(find.text('AI 仅读取确定性计算结果'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
