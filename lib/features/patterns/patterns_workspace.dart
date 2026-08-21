import 'package:flutter/material.dart';

import '../../widgets/empty_state.dart';
import '../analysis/technical_analysis.dart';
import '../rules/rule_engine.dart';

/// 盈利模式页：列出当前启用的经验规则。
class PatternsWorkspace extends StatelessWidget {
  const PatternsWorkspace({super.key, required this.ruleBook, this.analysis});

  final RuleBook ruleBook;
  final StockAnalysis? analysis;

  @override
  Widget build(BuildContext context) {
    final rules = ruleBook.activeRules;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('盈利模式', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        if (rules.isEmpty)
          const EmptyState(icon: Icons.auto_graph_outlined, title: '暂无规则'),
        for (final rule in rules)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.rule_outlined),
            title: Text(rule.name),
            subtitle: Text('优先级 ${rule.priority}'),
          ),
      ],
    );
  }
}
