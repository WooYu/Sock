import 'package:flutter/material.dart';

import 'persistent_review_store.dart';
import 'review_ai.dart';
import 'review_service.dart';

class ReviewWorkspace extends StatefulWidget {
  const ReviewWorkspace({super.key, this.store});

  final PersistentReviewStore? store;

  @override
  State<ReviewWorkspace> createState() => _ReviewWorkspaceState();
}

class _ReviewWorkspaceState extends State<ReviewWorkspace> {
  late final TradeReview _review;
  late final ReviewService _reviews;
  late final ReviewAiService _ai;
  ReviewSummary? _summary;
  ReviewNarrative? _narrative;
  var _weekly = false;
  var _narrativeId = 0;

  @override
  void initState() {
    super.initState();
    final ReviewRepository repository =
        widget.store ?? MemoryReviewRepository();
    _reviews = ReviewService(
      repository: repository,
      idFactory: () => 'review-1',
    );
    _review = TradeReview(
      id: 'review-1',
      stockCode: '600519',
      tradeId: 'trade-20260814',
      tradedAt: DateTime(2026, 8, 14, 10),
      plannedPrice: 1700,
      actualPrice: 1715,
      actualClose: 1730,
      predictionVersion: 2,
      predictedTarget: 1750,
      reason: '突破后回踩确认',
      invalidationReason: '量能不足',
    );
    final ReviewNarrativeRepository narrativeRepository =
        widget.store ?? MemoryReviewNarrativeRepository();
    final AiAuditLog audit = widget.store ?? MemoryAiAuditLog();
    _ai = ReviewAiService(
      adapter: const _DeterministicExplanationAdapter(),
      repository: narrativeRepository,
      audit: audit,
      idFactory: () => 'narrative-${++_narrativeId}',
    );
    _initialize(repository, narrativeRepository);
  }

  Future<void> _initialize(
    ReviewRepository repository,
    ReviewNarrativeRepository narratives,
  ) async {
    await repository.saveTrade(_review);
    final history = await narratives.history(_review.id);
    _narrativeId = history.length;
    if (history.isNotEmpty) _narrative = history.last;
    await _loadSummary();
  }

  Future<void> _loadSummary() async {
    final summary = _weekly
        ? await _reviews.weekly(_review.tradedAt)
        : await _reviews.daily(_review.tradedAt);
    if (mounted) setState(() => _summary = summary);
  }

  @override
  Widget build(BuildContext context) {
    final summary = _summary;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '交易复盘',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: false, label: Text('日复盘')),
                  ButtonSegment(value: true, label: Text('周复盘')),
                ],
                selected: {_weekly},
                showSelectedIcon: false,
                onSelectionChanged: (values) {
                  setState(() => _weekly = values.first);
                  _loadSummary();
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text('计划与执行', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 24,
            runSpacing: 12,
            children: [
              _Value(
                label: '计划价',
                value: _review.plannedPrice.toStringAsFixed(2),
              ),
              _Value(
                label: '实际成交',
                value: _review.actualPrice.toStringAsFixed(2),
              ),
              _Value(
                label: '执行偏差',
                value: '${(_review.slippagePercent * 100).toStringAsFixed(2)}%',
              ),
            ],
          ),
          const Divider(height: 32),
          Text('预测与实际走势', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 24,
            runSpacing: 12,
            children: [
              _Value(label: '预测版本', value: '${_review.predictionVersion}'),
              _Value(
                label: '预测目标',
                value: _review.predictedTarget.toStringAsFixed(2),
              ),
              _Value(
                label: '实际收盘',
                value: _review.actualClose.toStringAsFixed(2),
              ),
            ],
          ),
          const Divider(height: 32),
          if (summary != null) ...[
            Text(
              _weekly
                  ? '本周交易 ${summary.tradeCount} 笔'
                  : '当日交易 ${summary.tradeCount} 笔',
            ),
            const SizedBox(height: 8),
            Text('失效原因', style: Theme.of(context).textTheme.titleMedium),
            for (final entry in summary.invalidationReasons.entries)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(entry.key),
                trailing: Text('${entry.value} 次'),
              ),
          ],
          const Divider(height: 32),
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Text(
                      '复盘摘要',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.auto_awesome, size: 18),
                  ],
                ),
              ),
              if (_narrative != null) ...[
                IconButton(
                  tooltip: '编辑摘要',
                  onPressed: _editNarrative,
                  icon: const Icon(Icons.edit_outlined),
                ),
                IconButton(
                  tooltip: '重新生成',
                  onPressed: _regenerate,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ],
          ),
          const Text('AI 仅读取确定性计算结果'),
          const SizedBox(height: 8),
          if (_narrative == null)
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: _generate,
                icon: const Icon(Icons.auto_awesome),
                label: const Text('生成摘要'),
              ),
            )
          else ...[
            Text('文案版本 ${_narrative!.version}'),
            const SizedBox(height: 8),
            SelectableText(_narrative!.text),
          ],
        ],
      ),
    );
  }

  Future<void> _generate() async {
    final narrative = await _ai.generate(_review);
    setState(() => _narrative = narrative);
  }

  Future<void> _regenerate() async {
    final narrative = await _ai.regenerate(_review);
    setState(() => _narrative = narrative);
  }

  Future<void> _editNarrative() async {
    var text = _narrative!.text;
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('编辑复盘摘要'),
        content: SingleChildScrollView(
          child: TextFormField(
            initialValue: text,
            minLines: 4,
            maxLines: 8,
            onChanged: (value) => text = value,
          ),
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
    if (saved == true && text.trim().isNotEmpty) {
      final narrative = await _ai.edit(_review.id, text);
      setState(() => _narrative = narrative);
    }
  }
}

class _Value extends StatelessWidget {
  const _Value({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 130,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _DeterministicExplanationAdapter implements ReviewExplanationAdapter {
  const _DeterministicExplanationAdapter();

  @override
  Future<String> explain(ReviewSnapshot snapshot) async {
    final slippage = snapshot.actualPrice - snapshot.plannedPrice;
    final targetGap = snapshot.predictedTarget - snapshot.actualClose;
    return '计划价 ${snapshot.plannedPrice.toStringAsFixed(2)}，实际成交 '
        '${snapshot.actualPrice.toStringAsFixed(2)}，执行偏差 '
        '${slippage.toStringAsFixed(2)}。预测版本 ${snapshot.predictionVersion} '
        '的目标与实际收盘相差 ${targetGap.abs().toStringAsFixed(2)}。'
        '执行理由：${snapshot.reason}。';
  }
}
