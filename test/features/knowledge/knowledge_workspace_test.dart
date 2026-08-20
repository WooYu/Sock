import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/knowledge/knowledge.dart';
import 'package:stockcal/features/knowledge/knowledge_workspace.dart';

void main() {
  testWidgets('notes and rules tabs manage sources and rule toggles', (
    tester,
  ) async {
    final repo = MemoryKnowledgeRepository(
      sources: const [
        KnowledgeSource(
          id: 's1',
          title: '海龟',
          path: '股票/海龟.md',
          originalContent: '海龟是筑底形态。',
        ),
      ],
      drafts: const [
        KnowledgeDraft(
          id: 'd1',
          sourceId: 's1',
          kind: KnowledgeKind.concept,
          title: '海龟形态',
          summary: '海龟是筑底形态',
          excerpt: '海龟是筑底形态。',
          sourceLine: 1,
          status: ApprovalStatus.pending,
          extractionMethod: ExtractionMethod.ai,
        ),
      ],
    );
    repo.rules.add(
      const PublishedRule(
        id: 'r1',
        name: '海龟规则',
        description: '海龟是筑底形态',
        enabled: true,
      ),
    );
    final controller = KnowledgeController(repo);
    await controller.load();

    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: KnowledgeWorkspace(controller: controller))),
    );

    // 两个 tab
    expect(find.text('笔记 1'), findsOneWidget);
    expect(find.text('规则'), findsOneWidget);

    // 展开笔记详情
    await tester.tap(find.text('海龟'));
    await tester.pumpAndSettle();
    expect(find.text('海龟是筑底形态。'), findsOneWidget);
    expect(find.text('海龟形态'), findsOneWidget);

    // 批准草稿
    await tester.tap(find.byTooltip('批准'));
    await tester.pumpAndSettle();

    // 规则 tab + 开关切换
    await tester.tap(find.text('规则'));
    await tester.pumpAndSettle();
    expect(find.text('海龟规则'), findsOneWidget);
    final sw = find.byType(Switch);
    expect(sw, findsOneWidget);
    await tester.tap(sw);
    await tester.pumpAndSettle();
    expect(controller.rules.first.enabled, isFalse);
  });
}
