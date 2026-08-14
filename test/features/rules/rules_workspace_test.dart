import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/market/market_data.dart';
import 'package:stockcal/features/rules/rule_engine.dart';
import 'package:stockcal/features/rules/rules_workspace.dart';
import 'package:stockcal/features/knowledge/knowledge.dart';

void main() {
  testWidgets('creates a structured rule and publishes enable versions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final ruleBook = RuleBook(idFactory: () => 'user-rule');

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RulesWorkspace(
            ruleBook: ruleBook,
            candles: DemoAshareData.candlesFor('600519'),
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('新建规则'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, '规则名称'), '趋势放量');
    await tester.enterText(find.widgetWithText(TextFormField, '阈值'), '1.2');
    await tester.tap(find.text('创建'));
    await tester.pumpAndSettle();

    expect(find.text('趋势放量'), findsOneWidget);
    expect(find.text('版本 1'), findsOneWidget);
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(find.text('版本 2'), findsOneWidget);
    expect(ruleBook.versions('user-rule'), hasLength(2));
  });

  testWidgets(
    'generates immutable prediction and runs selected-rule backtest',
    (tester) async {
      tester.view.physicalSize = const Size(1100, 760);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final ruleBook = RuleBook(idFactory: () => 'unused');
      ruleBook.create(
        name: '趋势确认',
        priority: 10,
        conditions: const [
          RuleCondition(
            field: RuleField.closeAboveMa20,
            operator: RuleOperator.equals,
            value: 1,
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RulesWorkspace(
              ruleBook: ruleBook,
              candles: DemoAshareData.candlesFor('600519'),
            ),
          ),
        ),
      );

      await tester.tap(find.text('生成预测'));
      await tester.pumpAndSettle();
      expect(find.text('预测版本 1'), findsOneWidget);
      expect(find.text('计算证据'), findsOneWidget);
      expect(find.textContaining('目标位'), findsOneWidget);

      await tester.tap(find.text('运行回测'));
      await tester.pumpAndSettle();
      expect(find.text('回测统计'), findsOneWidget);
      expect(find.text('样本数'), findsOneWidget);
      expect(find.text('命中率'), findsOneWidget);
      expect(find.text('平均误差'), findsOneWidget);
      expect(find.text('最大回撤'), findsOneWidget);
    },
  );

  testWidgets('phone uses tabs without horizontal overflow', (tester) async {
    tester.view.physicalSize = const Size(375, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RulesWorkspace(
            ruleBook: RuleBook.withSystemDefaults(),
            candles: DemoAshareData.candlesFor('600519'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(TabBar), findsOneWidget);
    expect(find.text('规则'), findsOneWidget);
    expect(find.text('预测'), findsOneWidget);
    expect(find.text('回测'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shows approved note rules with source evidence', (tester) async {
    final knowledge = KnowledgeController(
      MemoryKnowledgeRepository(
        sources: const [
          KnowledgeSource(
            id: 's1',
            title: '关键点',
            path: '股票/关键点.md',
            originalContent: '触达目标位减仓。',
          ),
        ],
        drafts: const [
          KnowledgeDraft(
            id: 'd1',
            sourceId: 's1',
            kind: KnowledgeKind.rule,
            title: '目标位减仓',
            summary: '触达目标位时减仓',
            excerpt: '触达目标位减仓。',
            sourceLine: 1,
            status: ApprovalStatus.approved,
            extractionMethod: ExtractionMethod.ai,
          ),
        ],
      ),
    );
    await knowledge.load();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RulesWorkspace(
            ruleBook: RuleBook.withSystemDefaults(),
            candles: DemoAshareData.candlesFor('600519'),
            knowledgeController: knowledge,
          ),
        ),
      ),
    );

    expect(find.text('笔记规则来源'), findsOneWidget);
    expect(find.text('目标位减仓'), findsOneWidget);
    expect(find.textContaining('关键点 · 第 1 行'), findsOneWidget);
  });
}
