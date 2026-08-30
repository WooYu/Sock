import 'dart:async';

import 'package:flutter/material.dart';

import '../../domain/stockcal_domain.dart';
import 'backtest_engine.dart';
import '../decision/calibration.dart';
import '../decision/persistent_calibration_repository.dart';
import 'prediction_store.dart';
import 'persistent_rules_repository.dart';
import 'rule_engine.dart';
import '../knowledge/knowledge.dart';

class RulesWorkspace extends StatefulWidget {
  const RulesWorkspace({
    super.key,
    required this.ruleBook,
    required this.candles,
    this.stockCode = '600519',
    this.ruleRepository,
    this.predictionRepository,
    this.knowledgeController,
    this.calibrationBook,
    this.calibrationRepository,
    this.onCalibrationChanged,
  });

  final RuleBook ruleBook;
  final List<Candle> candles;
  final String stockCode;
  final PersistentRuleRepository? ruleRepository;
  final PredictionRepository? predictionRepository;
  final KnowledgeController? knowledgeController;
  final CalibrationBook? calibrationBook;
  final PersistentCalibrationRepository? calibrationRepository;
  final VoidCallback? onCalibrationChanged;

  @override
  State<RulesWorkspace> createState() => _RulesWorkspaceState();
}

class _RulesWorkspaceState extends State<RulesWorkspace> {
  late final PredictionService _predictions;
  RuleVersion? _selected;
  PredictionRecord? _prediction;
  BacktestResult? _backtest;
  String? _backtestError;
  var _predictionSequence = 0;

  @override
  void initState() {
    super.initState();
    _predictions = PredictionService(
      repository: widget.predictionRepository ?? MemoryPredictionRepository(),
      idFactory: () => 'prediction-${++_predictionSequence}',
    );
    if (widget.ruleBook.activeRules.isNotEmpty) {
      _selected = widget.ruleBook.activeRules.first;
    }
    widget.knowledgeController?.addListener(_refreshKnowledge);
  }

  @override
  void dispose() {
    widget.knowledgeController?.removeListener(_refreshKnowledge);
    super.dispose();
  }

  void _refreshKnowledge() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 760;
    final rules = _RulesPanel(
      ruleBook: widget.ruleBook,
      selected: _selected,
      onSelected: (rule) => setState(() => _selected = rule),
      onCreate: _createRule,
      onToggle: _toggleRule,
      knowledgeController: widget.knowledgeController,
    );
    final prediction = _PredictionPanel(
      prediction: _prediction,
      onGenerate: _generatePrediction,
      hasRule: _selected != null,
    );
    final backtest = _BacktestPanel(
      result: _backtest,
      error: _backtestError,
      onRun: _runBacktest,
      hasRule: _selected != null,
    );

    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: wide
          ? Row(
              children: [
                SizedBox(width: 330, child: rules),
                const VerticalDivider(width: 1),
                Expanded(
                  child: Column(
                    children: [
                      Expanded(child: prediction),
                      const Divider(height: 1),
                      Expanded(child: backtest),
                    ],
                  ),
                ),
              ],
            )
          : DefaultTabController(
              length: 3,
              child: Column(
                children: [
                  const TabBar(
                    tabs: [
                      Tab(text: '规则'),
                      Tab(text: '预测'),
                      Tab(text: '回测'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(children: [rules, prediction, backtest]),
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _createRule() async {
    var name = '';
    var threshold = '1.0';
    final created = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('新建规则'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                decoration: const InputDecoration(labelText: '规则名称'),
                onChanged: (value) => name = value,
              ),
              TextFormField(
                initialValue: threshold,
                decoration: const InputDecoration(labelText: '阈值'),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                onChanged: (value) => threshold = value,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('创建'),
          ),
        ],
      ),
    );
    final value = double.tryParse(threshold);
    if (created == true && name.trim().isNotEmpty && value != null) {
      final rule = widget.ruleBook.create(
        name: name.trim(),
        priority: 50,
        conditions: [
          RuleCondition(
            field: RuleField.volumeRatio,
            operator: RuleOperator.greaterThanOrEqual,
            value: value,
          ),
        ],
      );
      setState(() => _selected = rule);
      await widget.ruleRepository?.save(widget.ruleBook);
    }
  }

  void _toggleRule(RuleVersion rule, bool enabled) {
    final version = widget.ruleBook.setEnabled(rule.id, enabled);
    setState(() => _selected = version);
    final repository = widget.ruleRepository;
    if (repository != null) unawaited(repository.save(widget.ruleBook));
  }

  Future<void> _generatePrediction() async {
    final rule = _selected;
    if (rule == null) return;
    final record = await _predictions.generate(
      stockCode: widget.stockCode,
      candles: widget.candles,
      matchedRules: [rule],
    );
    setState(() => _prediction = record);
  }

  Future<void> _runBacktest() async {
    final rule = _selected;
    if (rule == null) return;
    try {
      const horizonSessions = 3;
      final result = BacktestEngine().run(
        request: BacktestRequest(
          stockCode: widget.stockCode,
          rule: rule,
          from: widget.candles.first.day,
          to: widget.candles.last.day,
          horizonSessions: horizonSessions,
          hitTolerance: 0.08,
        ),
        candles: widget.candles,
      );
      final calibrationBook = widget.calibrationBook;
      if (calibrationBook != null) {
        calibrationBook.upsert(
          CalibrationEntry(
            ruleId: rule.id,
            ruleVersion: rule.version,
            mode: rule.mode,
            timeframe: rule.timeframe,
            horizonSessions: horizonSessions,
            summary: result.toCalibration(),
          ),
        );
        await widget.calibrationRepository?.save(calibrationBook);
        widget.onCalibrationChanged?.call();
      }
      if (!mounted) return;
      setState(() {
        _backtest = result;
        _backtestError = null;
      });
    } on ArgumentError catch (error) {
      setState(() {
        _backtest = null;
        _backtestError = error.message?.toString() ?? '没有可评估样本';
      });
    }
  }
}

class _RulesPanel extends StatelessWidget {
  const _RulesPanel({
    required this.ruleBook,
    required this.selected,
    required this.onSelected,
    required this.onCreate,
    required this.onToggle,
    required this.knowledgeController,
  });

  final RuleBook ruleBook;
  final RuleVersion? selected;
  final ValueChanged<RuleVersion> onSelected;
  final VoidCallback onCreate;
  final void Function(RuleVersion rule, bool enabled) onToggle;
  final KnowledgeController? knowledgeController;

  @override
  Widget build(BuildContext context) {
    final latest = <RuleVersion>[
      for (final rule in ruleBook.activeRules) rule,
      if (selected != null && !selected!.enabled) selected!,
    ];
    final noteRules =
        knowledgeController?.approved
            .where((draft) => draft.kind == KnowledgeKind.rule)
            .toList(growable: false) ??
        const <KnowledgeDraft>[];
    return Column(
      children: [
        ListTile(
          title: const Text('规则版本'),
          trailing: IconButton(
            tooltip: '新建规则',
            onPressed: onCreate,
            icon: const Icon(Icons.add),
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: latest.isEmpty && noteRules.isEmpty
              ? const Center(child: Text('暂无规则'))
              : ListView(
                  children: [
                    for (final rule in latest)
                      ListTile(
                        selected: selected?.id == rule.id,
                        onTap: () => onSelected(rule),
                        title: Text(rule.name),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('版本 ${rule.version}'),
                            Text('优先级 ${rule.priority}'),
                          ],
                        ),
                        trailing: Switch(
                          value: rule.enabled,
                          onChanged: (value) => onToggle(rule, value),
                        ),
                      ),
                    if (noteRules.isNotEmpty) ...[
                      const Divider(),
                      const ListTile(
                        leading: Icon(Icons.source_outlined),
                        title: Text('笔记规则来源'),
                      ),
                      for (final draft in noteRules)
                        ListTile(
                          dense: true,
                          title: Text(draft.title),
                          subtitle: Text(
                            '${knowledgeController!.sourceFor(draft.sourceId).title} · 第 ${draft.sourceLine} 行',
                          ),
                        ),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

class _PredictionPanel extends StatelessWidget {
  const _PredictionPanel({
    required this.prediction,
    required this.onGenerate,
    required this.hasRule,
  });

  final PredictionRecord? prediction;
  final VoidCallback onGenerate;
  final bool hasRule;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                '不可变预测',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            FilledButton.icon(
              onPressed: hasRule ? onGenerate : null,
              icon: const Icon(Icons.auto_graph),
              label: const Text('生成预测'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (prediction == null)
          const Text('选择规则后生成新版本')
        else ...[
          Text('预测版本 ${prediction!.version}'),
          const SizedBox(height: 8),
          Text('目标位 ${prediction!.output.target.toStringAsFixed(2)}'),
          Text('支撑位 ${prediction!.output.support.toStringAsFixed(2)}'),
          Text('压力位 ${prediction!.output.resistance.toStringAsFixed(2)}'),
          Text(
            '置信度 ${(prediction!.output.confidence * 100).toStringAsFixed(0)}%',
          ),
          const SizedBox(height: 12),
          Text('计算证据', style: Theme.of(context).textTheme.titleSmall),
          for (final entry in prediction!.evidence.entries)
            Text('${entry.key} ${entry.value.toStringAsFixed(2)}'),
        ],
      ],
    );
  }
}

class _BacktestPanel extends StatelessWidget {
  const _BacktestPanel({
    required this.result,
    required this.error,
    required this.onRun,
    required this.hasRule,
  });

  final BacktestResult? result;
  final String? error;
  final VoidCallback onRun;
  final bool hasRule;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                '回测统计',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            FilledButton.icon(
              onPressed: hasRule ? onRun : null,
              icon: const Icon(Icons.play_arrow),
              label: const Text('运行回测'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (error != null)
          Text(
            error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          )
        else ...[
          if (result == null) const Text('选择规则并运行历史验证'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 24,
            runSpacing: 12,
            children: [
              _Metric(
                label: '样本数',
                value: result == null ? '--' : '${result!.sampleCount}',
              ),
              _Metric(
                label: '命中率',
                value: result == null
                    ? '--'
                    : '${(result!.hitRate * 100).toStringAsFixed(1)}%',
              ),
              _Metric(
                label: '平均误差',
                value: result == null
                    ? '--'
                    : '${(result!.meanAbsoluteError * 100).toStringAsFixed(2)}%',
              ),
              _Metric(
                label: '最大回撤',
                value: result == null
                    ? '--'
                    : '${(result!.maximumDrawdown * 100).toStringAsFixed(2)}%',
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
        ],
      ),
    );
  }
}
