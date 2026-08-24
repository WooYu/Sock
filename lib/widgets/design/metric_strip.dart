import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';
import 'mono_text.dart';

/// 指标格色调。
///
/// [profit] / [loss] 用于损益金额（绿盈红亏）；[risk] 为风险提示（同 loss 色）。
enum MetricTone { neutral, profit, loss, risk, accent }

/// 一个指标格的数据。
@immutable
class MetricCell {
  const MetricCell({
    required this.label,
    required this.value,
    this.unit,
    this.tone = MetricTone.neutral,
  });

  final String label;
  final String value;
  final String? unit;
  final MetricTone tone;
}

/// 指标条。还原原型 `.portfolio-metrics` ≡ `.stats-metrics` ≡ `.backtest-metrics`。
///
/// 宽屏按 [columns] 列排列；容器宽度小于 [narrowBreakpoint] 时降为
/// [narrowColumns] 列。每行不足列数时末格占满剩余宽度。
class MetricStrip extends StatelessWidget {
  const MetricStrip({
    super.key,
    required this.cells,
    this.columns = 6,
    this.narrowColumns = 2,
    this.narrowBreakpoint = 640,
  });

  final List<MetricCell> cells;
  final int columns;
  final int narrowColumns;
  final double narrowBreakpoint;

  static const double _gap = 9;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cols = constraints.maxWidth < narrowBreakpoint
            ? narrowColumns
            : columns;
        final rows = <Widget>[];
        var i = 0;
        while (i < cells.length) {
          final take = (cells.length - i) < cols ? cells.length - i : cols;
          final slice = cells.sublist(i, i + take);
          rows.add(
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var j = 0; j < slice.length; j++) ...[
                  if (j > 0) const SizedBox(width: _gap),
                  Expanded(
                    // 末行不足列数时，末格吃掉剩余列宽
                    flex: (j == slice.length - 1) ? cols - take + 1 : 1,
                    child: MetricTile(cell: slice[j]),
                  ),
                ],
              ],
            ),
          );
          i += take;
        }
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var k = 0; k < rows.length; k++) ...[
              if (k > 0) const SizedBox(height: _gap),
              rows[k],
            ],
          ],
        );
      },
    );
  }
}

/// 单个指标格。公开以便测试定位；业务代码请用 [MetricStrip]。
class MetricTile extends StatelessWidget {
  const MetricTile({super.key, required this.cell});

  final MetricCell cell;

  Color _valueColor(StockCalTokens t) => switch (cell.tone) {
    MetricTone.neutral => t.ink,
    MetricTone.profit => t.profit,
    MetricTone.loss => t.loss,
    MetricTone.risk => t.loss,
    MetricTone.accent => t.accent,
  };

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Container(
      constraints: const BoxConstraints(minHeight: 70),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: t.surfaceSunken,
        border: Border.all(color: t.tileLine, width: StockCalRadii.hairline),
        borderRadius: BorderRadius.circular(StockCalRadii.tile),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            cell.label,
            style: TextStyle(fontSize: StockCalType.eyebrow, color: t.faint),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: MonoText(
                  cell.value,
                  size: StockCalType.metric,
                  weight: FontWeight.w700,
                  color: _valueColor(t),
                ),
              ),
              if (cell.unit != null) ...[
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    cell.unit!,
                    style: TextStyle(
                      fontSize: StockCalType.eyebrow,
                      color: t.faint,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
