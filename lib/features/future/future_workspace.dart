import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../analysis/technical_analysis.dart';

/// 未来指标页：展示未来三日的 MA（5/10/20/60）与 BOLL 延伸。
class FutureWorkspace extends StatelessWidget {
  const FutureWorkspace({super.key, required this.analysis});

  final StockAnalysis analysis;

  static String _fmt(double value) =>
      value.isNaN ? '—' : value.toStringAsFixed(2);

  @override
  Widget build(BuildContext context) {
    final headers = [
      '日期',
      ...FutureIndicatorPoint.maPeriods.map((period) => 'MA$period'),
      'BOLL上',
      'BOLL中',
      'BOLL下',
    ];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('未来指标', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        Card(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(16),
            child: Table(
              defaultColumnWidth: const IntrinsicColumnWidth(),
              defaultVerticalAlignment: TableCellVerticalAlignment.middle,
              border: TableBorder(
                horizontalInside: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
              children: [
                TableRow(
                  children: [
                    for (final header in headers)
                      _header(context, header),
                  ],
                ),
                for (final point in analysis.future)
                  TableRow(
                    children: [
                      _cell(
                        context,
                        '${point.day.month.toString().padLeft(2, '0')}-${point.day.day.toString().padLeft(2, '0')}',
                      ),
                      for (final period in FutureIndicatorPoint.maPeriods)
                        _cell(context, _fmt(point.ma(period))),
                      _cell(context, _fmt(point.bollUpper)),
                      _cell(context, _fmt(point.bollMiddle)),
                      _cell(context, _fmt(point.bollLower)),
                    ],
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          '说明：未来指标为历史趋势的线性外推，仅作参考，不构成买卖建议。',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _header(BuildContext context, String text) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    child: Text(
      text,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w700,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    ),
  );

  Widget _cell(BuildContext context, String text) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    child: Text(
      text,
      style: withTabular(Theme.of(context).textTheme.bodyMedium),
    ),
  );
}
