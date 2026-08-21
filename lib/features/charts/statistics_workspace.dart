import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../../widgets/empty_state.dart';
import '../portfolio/portfolio_controller.dart';
import '../portfolio/portfolio_ledger.dart';

/// 统计图表页：持仓分布 + 累计已实现盈亏曲线。
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
    final series = portfolio.ledger.realizedProfitSeries();

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
        const SizedBox(height: 4),
        Text(
          '累计已实现盈亏',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
        if (series.length < 2)
          const EmptyState(icon: Icons.show_chart, title: '暂无历史净值')
        else
          SizedBox(
            height: 200,
            child: CustomPaint(
              key: const Key('equity-curve'),
              painter: _EquityCurvePainter(
                points: series,
                color: series.last.cumulativeProfit >= 0
                    ? gainColor(context)
                    : lossColor(context),
              ),
            ),
          ),
      ],
    );
  }
}

class _EquityCurvePainter extends CustomPainter {
  _EquityCurvePainter({required this.points, required this.color});

  final List<RealizedProfitPoint> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final profits = points.map((p) => p.cumulativeProfit).toList();
    final minP = profits.reduce((a, b) => a < b ? a : b);
    final maxP = profits.reduce((a, b) => a > b ? a : b);
    final range = (maxP - minP).abs() < 0.001 ? 1.0 : (maxP - minP);

    Offset offset(int index) => Offset(
      size.width * index / (points.length - 1),
      size.height * (maxP - profits[index]) / range,
    );

    final area = Path()..moveTo(0, size.height);
    for (var i = 0; i < points.length; i++) {
      area.lineTo(offset(i).dx, offset(i).dy);
    }
    area
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(area, Paint()..color = color.withValues(alpha: 0.15));

    final line = Path();
    for (var i = 0; i < points.length; i++) {
      final o = offset(i);
      i == 0 ? line.moveTo(o.dx, o.dy) : line.lineTo(o.dx, o.dy);
    }
    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_EquityCurvePainter old) =>
      old.points != points || old.color != color;
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
