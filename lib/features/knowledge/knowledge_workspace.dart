import 'package:flutter/material.dart';

import 'knowledge.dart';

class KnowledgeWorkspace extends StatelessWidget {
  const KnowledgeWorkspace({super.key, required this.controller});
  final KnowledgeController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => DefaultTabController(
        length: 3,
        child: Column(
          children: [
            if (controller.error != null)
              MaterialBanner(
                content: Text(controller.error!),
                actions: [
                  IconButton(
                    tooltip: '重试',
                    onPressed: controller.load,
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
            TabBar(
              tabs: [
                Tab(text: '待审批 ${controller.pending.length}'),
                const Tab(text: '经验概念'),
                const Tab(text: '原文'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _DraftList(
                    drafts: controller.pending,
                    controller: controller,
                    approvable: true,
                  ),
                  _DraftList(
                    drafts: controller.approved
                        .where((draft) => draft.kind != KnowledgeKind.rule)
                        .toList(),
                    controller: controller,
                    approvable: false,
                  ),
                  _SourceList(controller: controller),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DraftList extends StatelessWidget {
  const _DraftList({
    required this.drafts,
    required this.controller,
    required this.approvable,
  });
  final List<KnowledgeDraft> drafts;
  final KnowledgeController controller;
  final bool approvable;

  @override
  Widget build(BuildContext context) {
    if (drafts.isEmpty) return const Center(child: Text('暂无内容'));
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: drafts.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final draft = drafts[index];
        final source = controller.sourceFor(draft.sourceId);
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 8,
          ),
          leading: Icon(switch (draft.kind) {
            KnowledgeKind.rule => Icons.rule_outlined,
            KnowledgeKind.experience => Icons.psychology_alt_outlined,
            KnowledgeKind.concept => Icons.menu_book_outlined,
          }),
          title: Text(draft.title),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 4),
              Text(draft.summary),
              const SizedBox(height: 6),
              Text('来源：${source.title} · 第 ${draft.sourceLine} 行'),
              const SizedBox(height: 4),
              Text(
                draft.extractionMethod == ExtractionMethod.ai
                    ? 'AI 提炼'
                    : '本地初筛',
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
          trailing: approvable
              ? FilledButton.tonal(
                  onPressed: () => controller.approveAndPublish(draft.id),
                  child: const Text('批准'),
                )
              : null,
        );
      },
    );
  }
}

class _SourceList extends StatelessWidget {
  const _SourceList({required this.controller});
  final KnowledgeController controller;

  @override
  Widget build(BuildContext context) => ListView.separated(
    itemCount: controller.sources.length,
    separatorBuilder: (_, _) => const Divider(height: 1),
    itemBuilder: (context, index) {
      final source = controller.sources[index];
      return ListTile(
        leading: const Icon(Icons.description_outlined),
        title: Text(source.title),
        subtitle: Text(source.path),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => showDialog<void>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(source.title),
            content: SizedBox(
              width: 620,
              child: SingleChildScrollView(
                child: SelectableText(source.originalContent),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('关闭'),
              ),
            ],
          ),
        ),
      );
    },
  );
}
