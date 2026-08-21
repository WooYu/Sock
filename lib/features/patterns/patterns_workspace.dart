import 'package:flutter/material.dart';

import '../../widgets/empty_state.dart';
import '../../widgets/metric_card.dart';
import '../analysis/technical_analysis.dart';
import '../rules/rule_engine.dart';

/// 盈利模式页：评估启用规则对当前行情的命中状态。
class PatternsWorkspace extends StatelessWidget {
  const PatternsWorkspace({super.key, required this.ruleBook, this.analysis});

  final RuleBook ruleBook;
  final StockAnalysis? analysis;

  @override
  Widget build(BuildContext context) {
    final rules = ruleBook.activeRules;
    final facts = _facts();
    final hits = facts == null
        ? 0
        : rules.where((rule) => ruleBook.evaluate(rule, facts)).length;
    final hitRate = rules.isEmpty ? 0 : (hits * 100 / rules.length).round();

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('盈利模式', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        if (facts != null) ...[
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              MetricCard(label: '启用规则', value: '${rules.length}'),
              MetricCard(label: '今日命中', value: '$hits'),
              MetricCard(label: '命中率', value: '$hitRate%'),
            ],
          ),
          const SizedBox(height: 12),
        ],
        if (rules.isEmpty)
          const EmptyState(icon: Icons.auto_graph_outlined, title: '暂无规则'),
        for (final rule in rules)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.rule_outlined),
            title: Text(rule.name),
            subtitle: Text('${_bandLabel(rule.priority)} · 优先级 ${rule.priority}'),
            trailing: _status(context, facts, rule),
          ),
      ],
    );
  }

  RuleFacts? _facts() {
    final a = analysis;
    if (a == null) return null;
    return RuleFacts(
      closeAboveMa20: a.lastClose >= a.maLong,
      volumeRatio: a.volumeRatio,
      supportDistance: a.lastClose == 0
          ? 1
          : (a.lastClose - a.support) / a.lastClose,
    );
  }

  Widget _status(BuildContext context, RuleFacts? facts, RuleVersion rule) {
    if (facts == null) {
      return Text(
        '待定',
        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
      );
    }
    final hit = ruleBook.evaluate(rule, facts);
    return Text(
      hit ? '命中' : '未命中',
      style: TextStyle(
        color: hit
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.onSurfaceVariant,
        fontWeight: hit ? FontWeight.w600 : FontWeight.w400,
      ),
    );
  }

  static String _bandLabel(int priority) => priority <= 20
      ? '主策略'
      : priority <= 40
      ? '备选'
      : priority <= 60
      ? '风控'
      : '警戒';
}
