import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/knowledge/knowledge.dart';
import 'package:stockcal/features/knowledge/knowledge_workspace.dart';

void main() {
  testWidgets('reviews drafts and opens preserved source content', (
    tester,
  ) async {
    final controller = KnowledgeController(
      MemoryKnowledgeRepository(
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
      ),
    );
    await controller.load();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: KnowledgeWorkspace(controller: controller)),
      ),
    );
    expect(find.text('待审批 1'), findsOneWidget);
    expect(find.text('海龟形态'), findsOneWidget);
    expect(find.text('来源：海龟 · 第 1 行'), findsOneWidget);
    expect(find.text('AI 提炼'), findsOneWidget);

    await tester.tap(find.text('批准'));
    await tester.pumpAndSettle();
    expect(find.text('待审批 0'), findsOneWidget);

    await tester.tap(find.text('原文'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('海龟'));
    await tester.pumpAndSettle();
    expect(find.text('海龟是筑底形态。'), findsOneWidget);
  });
}
