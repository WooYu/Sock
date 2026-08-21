import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../../widgets/empty_state.dart';
import '../rules/prediction_store.dart';

/// 预测记录页：展示某只股票的不可变预测历史。
class PredictionsWorkspace extends StatefulWidget {
  const PredictionsWorkspace({
    super.key,
    required this.repository,
    required this.stockCode,
  });

  final PredictionRepository repository;
  final String stockCode;

  @override
  State<PredictionsWorkspace> createState() => _PredictionsWorkspaceState();
}

class _PredictionsWorkspaceState extends State<PredictionsWorkspace> {
  late Future<List<PredictionRecord>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.repository.history(widget.stockCode);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PredictionRecord>>(
      future: _future,
      builder: (context, snapshot) {
        final records = snapshot.data ?? const <PredictionRecord>[];
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('预测记录', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 12),
            if (records.isEmpty)
              const EmptyState(icon: Icons.history, title: '暂无预测记录'),
            for (final record in records)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.history),
                title: Text('${record.stockCode} · v${record.version}'),
                subtitle: Text(
                  '支撑 ${record.output.support.toStringAsFixed(2)} · 目标 ${record.output.target.toStringAsFixed(2)}',
                ),
                trailing: Text(
                  '${(record.output.confidence * 100).round()}%',
                  style: withTabular(null),
                ),
              ),
          ],
        );
      },
    );
  }
}
