import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/knowledge/knowledge.dart';

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
}
