import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../analysis/technical_analysis.dart';

/// 未来指标页：展示三日指标延伸。
class FutureWorkspace extends StatelessWidget {
  const FutureWorkspace({super.key, required this.analysis});

  final StockAnalysis analysis;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('未来指标', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        for (final point in analysis.future)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              '${point.day.month.toString().padLeft(2, '0')}-${point.day.day.toString().padLeft(2, '0')}',
            ),
            subtitle: Text(
              'MA${analysis.settings.maShortPeriod} ${point.maShort.toStringAsFixed(2)} · '
              'MA${analysis.settings.maLongPeriod} ${point.maLong.toStringAsFixed(2)}',
            ),
            trailing: Text(
              'BOLL ${point.bollUpper.toStringAsFixed(2)}',
              style: withTabular(null),
            ),
          ),
      ],
    );
  }
}
