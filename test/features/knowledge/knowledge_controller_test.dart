import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/decision/decision_models.dart';
import 'package:stockcal/features/knowledge/knowledge.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  test(
    'approval keeps source evidence and publishes only rule drafts',
    () async {
      final repository = MemoryKnowledgeRepository(
        sources: const [
          KnowledgeSource(
            id: 'source-1',
            title: '关键点',
            path: '股票/关键点.md',
            originalContent: '关键点规则：触达目标位减仓。\n经验：不要改变纪律。',
          ),
        ],
        drafts: const [
          KnowledgeDraft(
            id: 'rule-1',
            sourceId: 'source-1',
            kind: KnowledgeKind.rule,
            title: '触达目标位减仓',
            summary: '触达目标位减仓',
            excerpt: '关键点规则：触达目标位减仓。',
            sourceLine: 1,
            status: ApprovalStatus.pending,
          ),
        ],
      );
      final controller = KnowledgeController(repository);

      await controller.load();
      await controller.approveAndPublish('rule-1');

      expect(controller.pending, isEmpty);
      expect(controller.approved.single.excerpt, contains('目标位'));
      expect(repository.publishedRuleIds, ['rule-1']);
    },
  );

  test(
    'loads approved structured note rules into the deterministic RuleBook',
    () async {
      final repository = MemoryKnowledgeRepository(
        sources: const [
          KnowledgeSource(
            id: 'source-2',
            title: '趋势规则',
            path: '股票/趋势规则.md',
            originalContent: '收盘站上 MA5 且量比不低于 1.2。',
          ),
        ],
        drafts: const [
          KnowledgeDraft(
            id: 'rule-2',
            sourceId: 'source-2',
            kind: KnowledgeKind.rule,
            title: '趋势放量',
            summary: '收盘站上 MA5 且量比不低于 1.2',
            excerpt: '收盘站上 MA5 且量比不低于 1.2。',
            sourceLine: 1,
            status: ApprovalStatus.pending,
            conditions: [
              RuleCondition(
                field: RuleField.closeAboveMa5,
                operator: RuleOperator.equals,
                value: 1,
              ),
              RuleCondition(
                field: RuleField.volumeRatio,
                operator: RuleOperator.greaterThanOrEqual,
                value: 1.2,
              ),
            ],
            action: DecisionAction.enter,
            mode: StrategyMode.baseGranville,
            evidenceIds: ['source:1-1'],
          ),
        ],
      );
      final controller = KnowledgeController(repository);
      await controller.load();
      await controller.approveAndPublish('rule-2');

      final book = RuleBook.withSystemDefaults();
      expect(controller.applyPublishedRulesTo(book), isTrue);
      final rule = book.activeRules.firstWhere((item) => item.id == 'rule-2');
      expect(
        book.evaluate(
          rule,
          const RuleFacts(
            closeAboveMa20: true,
            volumeRatio: 1.3,
            supportDistance: 0.04,
            closeAboveMa5: true,
          ),
        ),
        isTrue,
      );
      expect(rule.evidenceIds, ['source:1-1']);
    },
  );

  test(
    'approved note without measurable conditions remains non-triggerable',
    () async {
      final repository = MemoryKnowledgeRepository(
        sources: const [
          KnowledgeSource(
            id: 'source-3',
            title: '经验',
            path: '股票/经验.md',
            originalContent: '不要因为涨停改变纪律。',
          ),
        ],
        drafts: const [
          KnowledgeDraft(
            id: 'experience-1',
            sourceId: 'source-3',
            kind: KnowledgeKind.experience,
            title: '纪律',
            summary: '不因涨停改变纪律',
            excerpt: '不要因为涨停改变纪律。',
            sourceLine: 1,
            status: ApprovalStatus.pending,
          ),
        ],
      );
      final controller = KnowledgeController(repository);
      await controller.load();
      await controller.approveAndPublish('experience-1');

      final book = RuleBook.withSystemDefaults();
      controller.applyPublishedRulesTo(book);

      expect(controller.rules.single.isExecutable, isFalse);
      expect(book.activeRules.where((item) => item.id == 'experience-1'), isEmpty);
    },
  );
}
