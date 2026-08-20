import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../../widgets/metric_card.dart';
import '../market/market_data.dart';
import '../knowledge/knowledge.dart';
import 'stock_analysis_controller.dart';
import 'technical_analysis.dart';

class StockAnalysisScreen extends StatefulWidget {
  const StockAnalysisScreen({
    super.key,
    required this.controller,
    this.knowledgeController,
  });

  final StockAnalysisController controller;
  final KnowledgeController? knowledgeController;

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
    required this.knowledge,
    required this.knowledgeController,
  });

  final MarketSnapshot snapshot;
  final StockAnalysis analysis;
  final VoidCallback onRefresh;
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
        Row(
          children: [
            Icon(
              _directionIcon(analysis.direction),
              size: 20,
              color: _directionColor(context, analysis.direction),
            ),
            const SizedBox(width: 6),
            Text(_directionLabel(analysis.direction)),
            const SizedBox(width: 10),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (analysis.directionStrength / 100).clamp(0.0, 1.0),
                  minHeight: 8,
                  backgroundColor: Theme.of(
                    context,
                  ).colorScheme.surfaceContainerHigh,
                  color: _directionColor(context, analysis.direction),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              '${analysis.directionStrength.round()}/100',
              style: withTabular(Theme.of(context).textTheme.bodyMedium),
            ),
          ],
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
              ],
            ),
          ),
        ),
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
        Text('命中规则', style: Theme.of(context).textTheme.titleMedium),
        ...analysis.matchedRules.map(
          (rule) => ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.check_circle_outline),
            title: Text(rule),
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
              '${point.maShort.toStringAsFixed(2)}  ·  '
              'MA${analysis.settings.maLongPeriod} '
              '${point.maLong.toStringAsFixed(2)}',
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

  static String _directionLabel(Direction direction) => switch (direction) {
    Direction.bullish => '多头',
    Direction.neutral => '中性',
    Direction.bearish => '空头',
  };

  static IconData _directionIcon(Direction direction) => switch (direction) {
    Direction.bullish => Icons.trending_up,
    Direction.neutral => Icons.trending_flat,
    Direction.bearish => Icons.trending_down,
  };

  static Color _directionColor(BuildContext context, Direction direction) =>
      switch (direction) {
        Direction.bullish => gainColor(context),
        Direction.neutral => Theme.of(context).colorScheme.onSurfaceVariant,
        Direction.bearish => lossColor(context),
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
