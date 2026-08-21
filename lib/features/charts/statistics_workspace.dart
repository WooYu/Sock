import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../../widgets/empty_state.dart';
import '../portfolio/portfolio_controller.dart';

/// 统计图表页：持仓分布 + 收益曲线（无历史净值时给引导空状态）。
class StatisticsWorkspace extends StatelessWidget {
  const StatisticsWorkspace({super.key, required this.portfolio});

  final PortfolioController portfolio;

  @override
  Widget build(BuildContext context) {
    final positions = portfolio.positions;
    final maxValue = positions.fold<double>(
      0,
      (max, p) => p.marketValue > max ? p.marketValue : max,
    );
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('统计图表', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 16),
        Text('持仓分布', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (positions.isEmpty)
          const EmptyState(icon: Icons.bar_chart, title: '暂无统计数据')
        else
          for (final position in positions)
            _DistributionBar(
              label: '${position.name} ${position.code}',
              value: position.marketValue,
              max: maxValue,
            ),
        const SizedBox(height: 24),
        Text('收益曲线', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        const EmptyState(icon: Icons.show_chart, title: '暂无历史净值'),
      ],
    );
  }
}

class _DistributionBar extends StatelessWidget {
  const _DistributionBar({
    required this.label,
    required this.value,
    required this.max,
  });

  final String label;
  final double value;
  final double max;

  @override
  Widget build(BuildContext context) {
    final ratio = max <= 0 ? 0.0 : (value / max).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label)),
              Text(value.toStringAsFixed(0), style: withTabular(null)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 8,
              backgroundColor: Theme.of(
                context,
              ).colorScheme.surfaceContainerHigh,
            ),
          ),
        ],
      ),
    );
  }
}
