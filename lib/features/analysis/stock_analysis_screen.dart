import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../../widgets/metric_card.dart';
import '../market/market_data.dart';
import '../knowledge/knowledge.dart';
import 'stock_analysis_controller.dart';
import 'direction_gauge.dart';
import 'technical_analysis.dart';

class StockAnalysisScreen extends StatefulWidget {
  const StockAnalysisScreen({
    super.key,
    required this.controller,
    this.knowledgeController,
    this.onOpenChart,
  });

  final StockAnalysisController controller;
  final KnowledgeController? knowledgeController;
  final VoidCallback? onOpenChart;

  @override
  State<StockAnalysisScreen> createState() => _StockAnalysisScreenState();
}

class _StockAnalysisScreenState extends State<StockAnalysisScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
    widget.knowledgeController?.addListener(_refresh);
    if (widget.controller.results.isEmpty &&
        widget.controller.selected == null) {
      widget.controller.initialize();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_refresh);
    widget.knowledgeController?.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return Material(
      color: Colors.transparent,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1040),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('个股分析', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 12),
              TextField(
                key: const Key('stock-search'),
                onChanged: controller.search,
                decoration: const InputDecoration(
                  labelText: '搜索 A 股',
                  hintText: '代码、名称或拼音',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                ),
              ),
              if (controller.results.isNotEmpty && controller.selected == null)
                ...controller.results.map(
                  (security) => ListTile(
                    minTileHeight: 56,
                    title: Text(security.name),
                    subtitle: Text(
                      '${security.code} · ${security.exchange} · ${security.industry}',
                    ),
                    onTap: () => controller.select(security),
                  ),
                ),
              if (controller.status == StockAnalysisStatus.loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (controller.status == StockAnalysisStatus.error)
                _ErrorBanner(
                  message: controller.errorMessage ?? '行情加载失败',
                  canRetry: controller.canRetry,
                  onRetry: controller.refresh,
                ),
              if (controller.snapshot != null && controller.analysis != null)
                _AnalysisContent(
                  snapshot: controller.snapshot!,
                  analysis: controller.analysis!,
                  onRefresh: controller.refresh,
                  onOpenChart: widget.onOpenChart,
                  cycle: controller.cycle,
                  onCycleChanged: controller.setCycle,
                  knowledge:
                      widget.knowledgeController?.approved
                          .where((draft) => draft.kind != KnowledgeKind.rule)
                          .toList(growable: false) ??
                      const [],
                  knowledgeController: widget.knowledgeController,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({
    required this.message,
    required this.canRetry,
    required this.onRetry,
  });

  final String message;
  final bool canRetry;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(
      Icons.error_outline,
      color: Theme.of(context).colorScheme.error,
    ),
    title: Text(message),
    trailing: canRetry
        ? TextButton(onPressed: onRetry, child: const Text('重试'))
        : null,
  );
}

class _AnalysisContent extends StatelessWidget {
  const _AnalysisContent({
    required this.snapshot,
    required this.analysis,
    required this.onRefresh,
    required this.cycle,
    required this.onCycleChanged,
    required this.knowledge,
    required this.knowledgeController,
    this.onOpenChart,
  });

  final MarketSnapshot snapshot;
  final StockAnalysis analysis;
  final VoidCallback onRefresh;
  final VoidCallback? onOpenChart;
  final OperationCycle cycle;
  final ValueChanged<OperationCycle> onCycleChanged;
  final List<KnowledgeDraft> knowledge;
  final KnowledgeController? knowledgeController;

  @override
  Widget build(BuildContext context) {
    final quote = snapshot.quote;
    final positive = quote.change >= 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    quote.security.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Text('${quote.security.code} · ${quote.security.exchange}'),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  quote.price.toStringAsFixed(2),
                  style: withTabular(
                    Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: pnlColor(context, quote.change),
                    ),
                  ),
                ),
                Text(
                  '${positive ? '+' : ''}${quote.changePercent.toStringAsFixed(2)}%',
                  style: withTabular(
                    Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: pnlColor(context, quote.change),
                    ),
                  ),
                ),
              ],
            ),
            IconButton(
              tooltip: '刷新行情',
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
            ),
            if (onOpenChart != null)
              OutlinedButton.icon(
                onPressed: onOpenChart,
                icon: const Icon(Icons.candlestick_chart_outlined, size: 18),
                label: const Text('专业 K 线'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(
              avatar: Icon(_stateIcon(snapshot.source.state), size: 18),
              label: Text(
                '${_stateLabel(snapshot.source.state)} · ${snapshot.source.name}',
              ),
            ),
            Chip(label: Text('涨停 ${quote.limitUp.toStringAsFixed(2)}')),
            Chip(label: Text('跌停 ${quote.limitDown.toStringAsFixed(2)}')),
          ],
        ),
        const SizedBox(height: 16),
        Center(
          child: DirectionGauge(
            strength: analysis.directionStrength,
            direction: analysis.direction,
          ),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: SegmentedButton<OperationCycle>(
            segments: OperationCycle.values
                .map((c) => ButtonSegment(value: c, label: Text(c.label)))
                .toList(),
            selected: {cycle},
            showSelectedIcon: false,
            onSelectionChanged: (values) => onCycleChanged(values.first),
          ),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _ValueTile(label: '支撑位', value: analysis.support),
            _ValueTile(label: '压力位', value: analysis.resistance),
            _ValueTile(label: '目标位', value: analysis.target),
            _ValueTile(
              label: '置信度',
              value: analysis.confidence * 100,
              suffix: '%',
            ),
          ],
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.auto_graph, size: 18),
                    const SizedBox(width: 6),
                    Text(
                      '策略建议',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Chip(
                      label: Text(analysis.trendPattern.label),
                      visualDensity: VisualDensity.compact,
                      side: BorderSide.none,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        analysis.trendReason,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _PlanRow(
                  label: '买入关注',
                  value:
                      '${analysis.support.toStringAsFixed(2)} ~ ${((analysis.support + analysis.resistance) / 2).toStringAsFixed(2)}',
                ),
                _PlanRow(
                  label: '卖出 / 止盈',
                  value: analysis.target.toStringAsFixed(2),
                ),
                _PlanRow(
                  label: '失效条件',
                  value: '收盘跌破 ${analysis.support.toStringAsFixed(2)}',
                ),
                const SizedBox(height: 8),
                ...analysis.conditions.map(
                  (c) => Row(
                    children: [
                      Icon(
                        c.met ? Icons.check_circle : Icons.circle_outlined,
                        size: 18,
                        color: c.met
                            ? Theme.of(context).colorScheme.primary
                            : null,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        c.label,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        _PipelineCard(analysis: analysis),
        const SizedBox(height: 20),
        Text('技术指标', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Indicator(
              label: 'MA${analysis.settings.maShortPeriod}',
              value: analysis.maShort,
            ),
            _Indicator(
              label: 'MA${analysis.settings.maLongPeriod}',
              value: analysis.maLong,
            ),
            _Indicator(
              label: 'EMA${analysis.settings.emaPeriod}',
              value: analysis.ema,
            ),
            _Indicator(label: 'BOLL 上轨', value: analysis.bollinger.upper),
            _Indicator(label: '量比', value: analysis.volumeRatio),
            Chip(label: Text('风险 ${_riskLabel(analysis.riskLevel)}')),
          ],
        ),
        const SizedBox(height: 20),
        Text('盈利模式识别', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: Text(
                '今日参数 ${analysis.parameters.length} 项 · 振幅 ${analysis.amplitude.toStringAsFixed(2)}%',
                style: Theme.of(context).textTheme.bodySmall,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '规则命中 ${analysis.ruleHitCount}/${analysis.ruleTotalCount}',
              style: withTabular(Theme.of(context).textTheme.bodySmall),
            ),
          ],
        ),
        ...analysis.matchedRules.map(
          (rule) => ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: Icon(
              rule.score >= 80 ? Icons.star : Icons.check_circle_outline,
              color: rule.score >= 80
                  ? Theme.of(context).colorScheme.primary
                  : null,
            ),
            title: Row(
              children: [
                Chip(
                  label: Text(_bandLabel(rule.band)),
                  visualDensity: VisualDensity.compact,
                  side: BorderSide.none,
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(rule.name)),
              ],
            ),
            trailing: Text(
              '${rule.score}',
              style: withTabular(
                Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: rule.score >= 80
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ),
        if (knowledge.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('相关经验与概念', style: Theme.of(context).textTheme.titleMedium),
          ...knowledge.map((draft) {
            final source = knowledgeController!.sourceFor(draft.sourceId);
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                draft.kind == KnowledgeKind.experience
                    ? Icons.psychology_alt_outlined
                    : Icons.menu_book_outlined,
              ),
              title: Text(draft.summary),
              subtitle: Text('${source.title} · 第 ${draft.sourceLine} 行'),
            );
          }),
        ],
        const SizedBox(height: 12),
        Text('未来三日指标延伸', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...analysis.future.map(
          (point) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(_date(point.day)),
            subtitle: Text(
              'MA${analysis.settings.maShortPeriod} '
              '${point.ma(analysis.settings.maShortPeriod).toStringAsFixed(2)}  ·  '
              'MA${analysis.settings.maLongPeriod} '
              '${point.ma(analysis.settings.maLongPeriod).toStringAsFixed(2)}',
            ),
            trailing: Text(
              'BOLL ${point.bollUpper.toStringAsFixed(2)}',
              style: withTabular(null),
            ),
          ),
        ),
      ],
    );
  }

  static String _date(DateTime day) =>
      '${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';

  static String _stateLabel(MarketDataState state) => switch (state) {
    MarketDataState.realtime => '实时行情',
    MarketDataState.delayed => '延迟行情',
    MarketDataState.stale => '行情已过期',
    MarketDataState.offlineCache => '离线缓存',
  };

  static IconData _stateIcon(MarketDataState state) => switch (state) {
    MarketDataState.realtime => Icons.bolt,
    MarketDataState.delayed => Icons.schedule,
    MarketDataState.stale => Icons.warning_amber,
    MarketDataState.offlineCache => Icons.cloud_off_outlined,
  };

  static String _riskLabel(RiskLevel risk) => switch (risk) {
    RiskLevel.low => '低',
    RiskLevel.medium => '中',
    RiskLevel.high => '高',
  };

  static String _bandLabel(RuleBand band) => switch (band) {
    RuleBand.primary => '主策略',
    RuleBand.alternate => '备选',
    RuleBand.risk => '风控',
    RuleBand.caution => '警戒',
  };
}

class _ValueTile extends StatelessWidget {
  const _ValueTile({
    required this.label,
    required this.value,
    this.suffix = '',
  });

  final String label;
  final double value;
  final String suffix;

  @override
  Widget build(BuildContext context) => MetricCard(
    label: label,
    value: '${value.toStringAsFixed(suffix.isEmpty ? 2 : 0)}$suffix',
    width: 144,
  );
}

class _PipelineCard extends StatelessWidget {
  const _PipelineCard({required this.analysis});

  final StockAnalysis analysis;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.account_tree_outlined, size: 18),
                const SizedBox(width: 6),
                Text(
                  '模型编排 · 可解释分析',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _Stage(
                    number: '01',
                    label: '数值计算层',
                    detail: 'MA·EMA·BOLL·量比',
                  ),
                ),
                Icon(
                  Icons.arrow_forward,
                  size: 16,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                Expanded(
                  child: _Stage(
                    number: '02',
                    label: '规则引擎层',
                    detail: '${analysis.matchedRules.length} 条命中',
                  ),
                ),
                Icon(
                  Icons.arrow_forward,
                  size: 16,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                Expanded(
                  child: _Stage(
                    number: '03',
                    label: 'AI解释层',
                    detail: '${(analysis.confidence * 100).round()}% 置信',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              switch (analysis.direction) {
                Direction.bullish => '策略结论：偏多，关注买入区间',
                Direction.bearish => '策略结论：偏空，注意失效条件',
                Direction.neutral => '策略结论：中性，等待方向确认',
              },
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 4),
            Text(
              '解释依据：命中 ${analysis.ruleHitCount}/${analysis.ruleTotalCount} 条规则，置信 ${(analysis.confidence * 100).round()}%',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 4),
            Text(
              '待确认经验：复核目标位与失效条件',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(
                  label: Text('策略匹配度 ${(analysis.confidence * 100).round()}'),
                ),
                Chip(label: Text('规则可信度 ${analysis.ruleCredibility.round()}')),
                Chip(
                  label: Text(
                    '风险等级 ${switch (analysis.riskLevel) {
                      RiskLevel.low => '低',
                      RiskLevel.medium => '中',
                      RiskLevel.high => '高',
                    }}',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '当前模型：${analysis.modelName}',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _Stage extends StatelessWidget {
  const _Stage({required this.number, required this.label, required this.detail});

  final String number;
  final String label;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          number,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 2),
        Text(detail, style: Theme.of(context).textTheme.labelSmall),
      ],
    );
  }
}

class _PlanRow extends StatelessWidget {
  const _PlanRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 88,
            child: Text(label, style: Theme.of(context).textTheme.bodySmall),
          ),
          Expanded(
            child: Text(
              value,
              style: withTabular(
                Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Indicator extends StatelessWidget {
  const _Indicator({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) =>
      Chip(label: Text('$label ${value.toStringAsFixed(2)}'));
}
