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
        length: 2,
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
                Tab(text: '笔记 ${controller.sources.length}'),
                const Tab(text: '规则'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _NotesTab(controller: controller),
                  _RulesTab(controller: controller),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotesTab extends StatelessWidget {
  const _NotesTab({required this.controller});

  final KnowledgeController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.sources.isEmpty) {
      return const Center(child: Text('暂无笔记'));
    }
    return ListView(
      children: [
        for (final source in controller.sources)
          ExpansionTile(
            leading: const Icon(Icons.description_outlined),
            title: Text(source.title),
            subtitle: Text(source.path),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: '预览原文',
                  onPressed: () => _previewSource(context, source),
                  icon: const Icon(Icons.visibility_outlined, size: 20),
                ),
                _sourceStatus(context, source),
              ],
            ),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      source.originalContent,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  PopupMenuButton<String>(
                    onSelected: (action) => _sourceAction(context, action, source),
                    itemBuilder: (context) => const [
                      PopupMenuItem(value: 'edit', child: Text('编辑原文')),
                      PopupMenuItem(value: 'reextract', child: Text('重新识别')),
                      PopupMenuItem(value: 'delete', child: Text('删除')),
                    ],
                  ),
                ],
              ),
              const Divider(height: 20),
              for (final draft
                  in controller.drafts.where((d) => d.sourceId == source.id))
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    draft.kind == KnowledgeKind.rule
                        ? Icons.rule_outlined
                        : Icons.menu_book_outlined,
                  ),
                  title: Text(draft.title),
                  subtitle: Text(draft.summary),
                  trailing: Wrap(
                    spacing: 4,
                    children: [
                      IconButton(
                        tooltip: '编辑',
                        onPressed: () => _editDraft(context, draft),
                        icon: const Icon(Icons.edit_outlined, size: 18),
                      ),
                      if (draft.status == ApprovalStatus.pending)
                        IconButton(
                          tooltip: '批准',
                          onPressed: () => controller.approveAndPublish(draft.id),
                          icon: const Icon(Icons.check_circle_outline, size: 18),
                        ),
                    ],
                  ),
                ),
              if (controller.drafts.where((d) => d.sourceId == source.id).isEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    '尚未识别，点「重新识别」用 AI 抽取规则',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget _sourceStatus(BuildContext context, KnowledgeSource source) {
    final count = controller.drafts
        .where((d) => d.sourceId == source.id)
        .length;
    return Chip(
      label: Text(count == 0 ? '未识别' : '已识别 $count 条'),
      visualDensity: VisualDensity.compact,
    );
  }

  Future<void> _previewSource(
    BuildContext context,
    KnowledgeSource source,
  ) {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(source.title),
        content: SizedBox(
          width: 560,
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
    );
  }

  Future<void> _sourceAction(
    BuildContext context,
    String action,
    KnowledgeSource source,
  ) async {
    switch (action) {
      case 'edit':
        await _editSource(context, source);
      case 'reextract':
        await controller.extract(source.id);
      case 'delete':
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('删除笔记'),
            content: const Text('删除后连同草稿和已发布规则一并移除，不可恢复。'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('取消'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('删除'),
              ),
            ],
          ),
        );
        if (confirmed == true) await controller.deleteSource(source.id);
    }
  }

  Future<void> _editSource(BuildContext context, KnowledgeSource source) async {
    var content = source.originalContent;
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('编辑原文'),
        content: TextField(
          maxLines: 6,
          controller: TextEditingController(text: content),
          onChanged: (value) => content = value,
          decoration: const InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (saved == true) await controller.updateSource(source.id, content);
  }

  Future<void> _editDraft(BuildContext context, KnowledgeDraft draft) async {
    var title = draft.title;
    var summary = draft.summary;
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('编辑规则草稿'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: TextEditingController(text: title),
              onChanged: (value) => title = value,
              decoration: const InputDecoration(labelText: '标题'),
            ),
            TextField(
              controller: TextEditingController(text: summary),
              onChanged: (value) => summary = value,
              decoration: const InputDecoration(labelText: '摘要'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (saved == true) await controller.updateDraft(draft.id, title, summary);
  }
}

class _RulesTab extends StatelessWidget {
  const _RulesTab({required this.controller});

  final KnowledgeController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.rules.isEmpty) {
      return const Center(child: Text('暂无规则'));
    }
    return ListView(
      children: [
        for (final rule in controller.rules)
          Opacity(
            opacity: rule.enabled ? 1 : 0.45,
            child: ListTile(
              leading: const Icon(Icons.rule_outlined),
              title: Text(rule.name),
              subtitle: Text(rule.description),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!rule.enabled)
                    Text(
                      '已停用',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  Switch(
                    value: rule.enabled,
                    onChanged: (value) => controller.toggleRule(rule.id, value),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
