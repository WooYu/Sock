import 'package:flutter/material.dart';

import '../portfolio/portfolio_ledger.dart';
import 'persistent_review_store.dart';
import 'review_ai.dart';
import 'review_service.dart';

class ReviewWorkspace extends StatefulWidget {
  const ReviewWorkspace({
    super.key,
    this.store,
    this.trades = const [],
    this.explanationAdapter,
  });

  final PersistentReviewStore? store;
  final List<TradeEntry> trades;
  final ReviewExplanationAdapter? explanationAdapter;

  @override
  State<ReviewWorkspace> createState() => _ReviewWorkspaceState();
}

class _ReviewWorkspaceState extends State<ReviewWorkspace> {
  TradeReview? _review;
  late final ReviewService _reviews;
  late final ReviewAiService _ai;
  ReviewSummary? _summary;
  ReviewNarrative? _narrative;
  String? _aiError;
  var _weekly = false;
  var _narrativeId = 0;
  var _initialized = false;

  @override
  void initState() {
    super.initState();
    final ReviewRepository repository =
        widget.store ?? MemoryReviewRepository();
    _reviews = ReviewService(
      repository: repository,
      idFactory: () => 'review-${DateTime.now().microsecondsSinceEpoch}',
    );
    final ReviewNarrativeRepository narrativeRepository =
        widget.store ?? MemoryReviewNarrativeRepository();
    final AiAuditLog audit = widget.store ?? MemoryAiAuditLog();
    _ai = ReviewAiService(
      adapter:
          widget.explanationAdapter ?? const _DeterministicExplanationAdapter(),
      repository: narrativeRepository,
      audit: audit,
      idFactory: () => 'narrative-${++_narrativeId}',
    );
    _initialize(
      repository,
      narrativeRepository,
      fixture: widget.store == null ? _fixtureReview() : null,
    );
  }

  Future<void> _initialize(
    ReviewRepository repository,
    ReviewNarrativeRepository narratives, {
    TradeReview? fixture,
  }) async {
    if (fixture != null) await repository.saveTrade(fixture);
    final reviews = await repository.tradeReviews();
    if (reviews.isEmpty) {
      if (mounted) setState(() => _initialized = true);
      return;
    }
    _review = reviews.last;
    final history = await narratives.history(_review!.id);
    _narrativeId = history.length;
    if (history.isNotEmpty) _narrative = history.last;
    _initialized = true;
    await _loadSummary();
  }

  Future<void> _loadSummary() async {
    final review = _review;
    if (review == null) return;
    final summary = _weekly
        ? await _reviews.weekly(review.tradedAt)
        : await _reviews.daily(review.tradedAt);
    if (mounted) setState(() => _summary = summary);
  }

  @override
  Widget build(BuildContext context) {
    final review = _review;
    if (review == null) return _buildEmpty(context);
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
                value: review.plannedPrice.toStringAsFixed(2),
              ),
              _Value(
                label: '实际成交',
                value: review.actualPrice.toStringAsFixed(2),
              ),
              _Value(
                label: '执行偏差',
                value: '${(review.slippagePercent * 100).toStringAsFixed(2)}%',
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
              _Value(label: '预测版本', value: '${review.predictionVersion}'),
              _Value(
                label: '预测目标',
                value: review.predictedTarget.toStringAsFixed(2),
              ),
              _Value(
                label: '实际收盘',
                value: review.actualClose.toStringAsFixed(2),
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
          if (_aiError != null) ...[
            const SizedBox(height: 8),
            Text(
              _aiError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
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

  Widget _buildEmpty(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surface,
    child: Center(
      child: _initialized
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.rate_review_outlined, size: 40),
                const SizedBox(height: 12),
                Text('交易复盘', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text('暂无复盘记录'),
                const SizedBox(height: 4),
                Text(
                  _reviewableTrades.isEmpty
                      ? '请先在组合交易中记录买卖'
                      : '选择一笔真实交易并补充复盘信息',
                ),
                if (_reviewableTrades.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _createReview,
                    icon: const Icon(Icons.add),
                    label: const Text('从交易创建复盘'),
                  ),
                ],
              ],
            )
          : const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.hourglass_empty),
                SizedBox(height: 8),
                Text('正在读取复盘记录'),
              ],
            ),
    ),
  );

  Future<void> _generate() async {
    try {
      final narrative = await _ai.generate(_review!);
      if (mounted) {
        setState(() {
          _narrative = narrative;
          _aiError = null;
        });
      }
    } on Object {
      if (mounted) setState(() => _aiError = 'AI 复盘暂不可用，请稍后重试');
    }
  }

  List<TradeEntry> get _reviewableTrades => widget.trades
      .where(
        (entry) =>
            entry.type == TradeEntryType.buy ||
            entry.type == TradeEntryType.sell,
      )
      .toList(growable: false);

  Future<void> _createReview() async {
    final formKey = GlobalKey<FormState>();
    var trade = _reviewableTrades.first;
    var plannedPrice = '';
    var actualClose = '';
    var predictionVersion = '';
    var predictedTarget = '';
    var reason = '';
    var invalidationReason = '';
    final draft = await showDialog<_ReviewDraft>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('创建交易复盘'),
        content: SizedBox(
          width: 440,
          child: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<TradeEntry>(
                    initialValue: trade,
                    decoration: const InputDecoration(labelText: '交易记录'),
                    items: [
                      for (final item in _reviewableTrades)
                        DropdownMenuItem(
                          value: item,
                          child: Text(
                            '${item.code} ${item.name} · ${item.price.toStringAsFixed(2)}',
                          ),
                        ),
                    ],
                    onChanged: (value) {
                      if (value != null) trade = value;
                    },
                  ),
                  const SizedBox(height: 12),
                  _numberField('计划价', (value) => plannedPrice = value),
                  const SizedBox(height: 12),
                  _numberField('实际收盘', (value) => actualClose = value),
                  const SizedBox(height: 12),
                  TextFormField(
                    decoration: const InputDecoration(labelText: '预测版本'),
                    keyboardType: TextInputType.number,
                    validator: (value) =>
                        int.tryParse(value ?? '') == null ? '请输入预测版本号' : null,
                    onChanged: (value) => predictionVersion = value,
                  ),
                  const SizedBox(height: 12),
                  _numberField('预测目标', (value) => predictedTarget = value),
                  const SizedBox(height: 12),
                  TextFormField(
                    decoration: const InputDecoration(labelText: '执行理由'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? '请输入执行理由'
                        : null,
                    onChanged: (value) => reason = value,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    decoration: const InputDecoration(labelText: '失效原因（可选）'),
                    onChanged: (value) => invalidationReason = value,
                  ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() != true) return;
              Navigator.pop(
                context,
                _ReviewDraft(
                  trade,
                  double.parse(plannedPrice),
                  double.parse(actualClose),
                  int.parse(predictionVersion),
                  double.parse(predictedTarget),
                  reason.trim(),
                  invalidationReason.trim(),
                ),
              );
            },
            child: const Text('保存复盘'),
          ),
        ],
      ),
    );
    if (draft == null) return;
    final review = await _reviews.createTradeReview(
      stockCode: draft.trade.code!,
      tradeId: draft.trade.id,
      tradedAt: draft.trade.occurredAt,
      plannedPrice: draft.plannedPrice,
      actualPrice: draft.trade.price,
      actualClose: draft.actualClose,
      predictionVersion: draft.predictionVersion,
      predictedTarget: draft.predictedTarget,
      reason: draft.reason,
      invalidationReason: draft.invalidationReason.isEmpty
          ? null
          : draft.invalidationReason,
    );
    if (!mounted) return;
    setState(() {
      _review = review;
      _summary = null;
      _narrative = null;
    });
    await _loadSummary();
  }

  Widget _numberField(String label, ValueChanged<String> onChanged) =>
      TextFormField(
        decoration: InputDecoration(labelText: label),
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        validator: (value) {
          final number = double.tryParse(value ?? '');
          return number == null || number <= 0 ? '请输入有效价格' : null;
        },
        onChanged: onChanged,
      );

  Future<void> _regenerate() async {
    try {
      final narrative = await _ai.regenerate(_review!);
      if (mounted) {
        setState(() {
          _narrative = narrative;
          _aiError = null;
        });
      }
    } on Object {
      if (mounted) setState(() => _aiError = 'AI 复盘暂不可用，请稍后重试');
    }
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
      final narrative = await _ai.edit(_review!.id, text);
      setState(() => _narrative = narrative);
    }
  }

  TradeReview _fixtureReview() => TradeReview(
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
}

class _ReviewDraft {
  const _ReviewDraft(
    this.trade,
    this.plannedPrice,
    this.actualClose,
    this.predictionVersion,
    this.predictedTarget,
    this.reason,
    this.invalidationReason,
  );

  final TradeEntry trade;
  final double plannedPrice;
  final double actualClose;
  final int predictionVersion;
  final double predictedTarget;
  final String reason;
  final String invalidationReason;
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
