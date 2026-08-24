import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 表格列定义。[flex] 为相对宽度权重，还原原型的 `grid-template-columns` 比例
/// （如 `1.2fr 1fr .9fr` 写成 12 / 10 / 9）。
@immutable
class LedgerColumn {
  const LedgerColumn(this.label, this.flex);

  final String label;
  final int flex;
}

/// 表格一行。[cells] 长度须与列数一致。
@immutable
class LedgerRow {
  const LedgerRow({required this.cells, this.onTap});

  final List<Widget> cells;
  final VoidCallback? onTap;
}

/// 账本式表格。还原原型 `.portfolio-table` ≡ `.backtest-table`。
class LedgerTable extends StatelessWidget {
  const LedgerTable({
    super.key,
    required this.columns,
    required this.rows,
  });

  final List<LedgerColumn> columns;
  final List<LedgerRow> rows;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Container(
      key: const ValueKey('ledger-shell'),
      decoration: BoxDecoration(
        border: Border.all(color: t.tileLine, width: StockCalRadii.hairline),
        borderRadius: BorderRadius.circular(StockCalRadii.button),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            key: const ValueKey('ledger-head'),
            decoration: BoxDecoration(color: t.surfaceHeader),
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
            child: Row(
              children: [
                for (var i = 0; i < columns.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    flex: columns[i].flex,
                    child: Text(
                      columns[i].label,
                      style: TextStyle(
                        fontSize: StockCalType.eyebrow,
                        color: t.faint,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          for (final row in rows)
            _LedgerRowView(row: row, columns: columns, showTopBorder: true),
        ],
      ),
    );
  }
}

class _LedgerRowView extends StatelessWidget {
  const _LedgerRowView({
    required this.row,
    required this.columns,
    required this.showTopBorder,
  });

  final LedgerRow row;
  final List<LedgerColumn> columns;
  final bool showTopBorder;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final content = Container(
      decoration: BoxDecoration(
        color: t.surface,
        border: showTopBorder
            ? Border(top: BorderSide(color: t.softLine, width: 1))
            : null,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
      child: Row(
        children: [
          for (var i = 0; i < columns.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              flex: columns[i].flex,
              child: i < row.cells.length ? row.cells[i] : const SizedBox(),
            ),
          ],
        ],
      ),
    );
    if (row.onTap == null) return content;
    return InkWell(onTap: row.onTap, child: content);
  }
}
