import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/metric_card.dart';
import 'portfolio_controller.dart';
import 'portfolio_ledger.dart';

enum _PortfolioAction { create, rename, delete }

class PortfolioScreen extends StatefulWidget {
  const PortfolioScreen({super.key, required this.controller});

  final PortfolioController controller;

  @override
  State<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends State<PortfolioScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  key: const Key('portfolio-switcher'),
                  value: controller.activeId,
                  isExpanded: true,
                  style: Theme.of(context).textTheme.headlineSmall,
                  items: [
                    for (final portfolio in controller.portfolios)
                      DropdownMenuItem(
                        value: portfolio.id,
                        child: Text(
                          portfolio.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (id) {
                    if (id != null) controller.switchPortfolio(id);
                  },
                ),
              ),
            ),
            PopupMenuButton<_PortfolioAction>(
              key: const Key('portfolio-actions'),
              tooltip: '组合操作',
              onSelected: _handlePortfolioAction,
              itemBuilder: (context) => const [
                PopupMenuItem(
                  value: _PortfolioAction.create,
                  child: Text('新建组合'),
                ),
                PopupMenuItem(
                  value: _PortfolioAction.rename,
                  child: Text('重命名'),
                ),
                PopupMenuItem(
                  value: _PortfolioAction.delete,
                  child: Text('删除组合'),
                ),
              ],
            ),
            IconButton(
              tooltip: '导入交易',
              onPressed: _showImportPreview,
              icon: const Icon(Icons.upload_file_outlined),
            ),
            IconButton(
              tooltip: '记一笔交易',
              onPressed: _showTradeEditor,
              icon: const Icon(Icons.add_circle_outline),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Metric(label: '现金', value: _money(controller.ledger.cashBalance)),
            _Metric(label: '持仓市值', value: _money(controller.marketValue)),
            _Metric(
              label: '累计盈亏',
              value: _money(controller.totalProfit),
              color: pnlColor(context, controller.totalProfit),
            ),
            _Metric(
              label: '浮动盈亏',
              value: _money(controller.floatingProfit),
              color: pnlColor(context, controller.floatingProfit),
            ),
          ],
        ),
        if (controller.portfolios.length > 1) ...[
          const SizedBox(height: 8),
          Text(
            '全部组合  市值 ${_money(controller.totalMarketValue)} · '
            '累计盈亏 ${_money(controller.totalCombinedProfit)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
        const SizedBox(height: 20),
        Text('持仓', style: Theme.of(context).textTheme.titleMedium),
        if (controller.positions.isEmpty)
          EmptyState(
            icon: Icons.account_balance_wallet_outlined,
            title: '暂无持仓',
            message: '记录一笔交易后在这里汇总',
            actionLabel: '记一笔',
            onAction: () {
              _showTradeEditor();
            },
          )
        else
          for (final position in controller.positions)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(position.name),
              subtitle: Text('${position.code}  ${position.quantity} 股'),
              trailing: Text(
                '浮动盈亏 ${_money(position.floatingProfit)}',
                style: withTabular(
                  Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: pnlColor(context, position.floatingProfit),
                  ),
                ),
              ),
            ),
        const Divider(),
        Row(
          children: [
            Expanded(
              child: Text(
                '交易流水',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            if (controller.latestImport != null)
              TextButton.icon(
                onPressed: () {
                  controller.undoLatestImport();
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(const SnackBar(content: Text('已撤销最近导入')));
                },
                icon: const Icon(Icons.undo),
                label: const Text('撤销导入'),
              ),
          ],
        ),
        for (final entry in controller.ledger.entries.reversed)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(_entryIcon(entry.type)),
            title: Text(entry.name ?? entry.note ?? '账户费用'),
            subtitle: Text(_entryDescription(entry)),
          ),
      ],
    );
  }

  Future<void> _showTradeEditor() async {
    final result = await showModalBottomSheet<_TradeDraft>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _TradeEditor(),
    );
    if (result == null) return;
    try {
      widget.controller.record(
        type: result.type,
        code: result.code,
        name: result.name,
        quantity: result.quantity,
        price: result.price,
        fee: result.fee,
        cashAmount: result.cashAmount,
        note: result.note,
      );
    } on LedgerValidationException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _showImportPreview() async {
    final preview = widget.controller.previewSampleImport();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('预览 ${preview.entries.length} 条记录'),
        content: Text(
          preview.isValid
              ? '校验通过'
              : preview.errors
                    .map((error) => '第 ${error.rowNumber} 行：${error.message}')
                    .join('\n'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: preview.isValid
                ? () => Navigator.pop(context, true)
                : null,
            child: const Text('确认导入'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    widget.controller.commitImport(preview);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已导入 ${preview.entries.length} 条记录')),
    );
  }

  static String _money(double value) => '¥${value.toStringAsFixed(2)}';

  Future<void> _handlePortfolioAction(_PortfolioAction action) async {
    switch (action) {
      case _PortfolioAction.create:
        final name = await _promptForName('新建组合');
        if (name == null || name.isEmpty) return;
        try {
          widget.controller.createPortfolio(name);
        } on LedgerValidationException catch (error) {
          _showError(error.message);
        }
      case _PortfolioAction.rename:
        final name = await _promptForName(
          '重命名组合',
          initial: widget.controller.activePortfolio.name,
        );
        if (name == null || name.isEmpty) return;
        try {
          widget.controller.renameActivePortfolio(name);
        } on LedgerValidationException catch (error) {
          _showError(error.message);
        }
      case _PortfolioAction.delete:
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('删除组合'),
            content: const Text('删除后该组合的交易记录将一并移除，且不可恢复。'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('取消'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('删除'),
              ),
            ],
          ),
        );
        if (confirmed != true) return;
        try {
          widget.controller.deleteActivePortfolio();
        } on StateError catch (error) {
          _showError(error.message);
        }
    }
  }

  Future<String?> _promptForName(String title, {String initial = ''}) async {
    var value = initial;
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          key: const Key('portfolio-name'),
          autofocus: true,
          onChanged: (text) => value = text,
          decoration: InputDecoration(
            labelText: '组合名称',
            hintText: initial.isEmpty ? null : initial,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, value.trim()),
            child: const Text('确定'),
          ),
        ],
      ),
    );
    return result;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  static IconData _entryIcon(TradeEntryType type) => switch (type) {
    TradeEntryType.buy => Icons.add_chart,
    TradeEntryType.sell => Icons.trending_down,
    TradeEntryType.dividend => Icons.payments_outlined,
    TradeEntryType.bonus => Icons.call_split,
    TradeEntryType.fee => Icons.receipt_long_outlined,
  };

  static String _entryDescription(TradeEntry entry) => switch (entry.type) {
    TradeEntryType.buy => '买入 ${entry.quantity} 股 @ ${_money(entry.price)}',
    TradeEntryType.sell => '卖出 ${entry.quantity} 股 @ ${_money(entry.price)}',
    TradeEntryType.dividend => '现金分红 ${_money(entry.cashAmount)}',
    TradeEntryType.bonus => '送转 ${entry.quantity} 股',
    TradeEntryType.fee => '费用 ${_money(entry.feeAmount)}',
  };
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) => MetricCard(
    label: label,
    value: value,
    color: color,
    width: 136,
  );
}

class _TradeEditor extends StatefulWidget {
  const _TradeEditor();

  @override
  State<_TradeEditor> createState() => _TradeEditorState();
}

class _TradeEditorState extends State<_TradeEditor> {
  TradeEntryType type = TradeEntryType.buy;
  final fields = <String, String>{};

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          16 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('记一笔', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              SegmentedButton<TradeEntryType>(
                segments: const [
                  ButtonSegment(value: TradeEntryType.buy, label: Text('买入')),
                  ButtonSegment(value: TradeEntryType.sell, label: Text('卖出')),
                  ButtonSegment(
                    value: TradeEntryType.dividend,
                    label: Text('分红'),
                  ),
                  ButtonSegment(value: TradeEntryType.bonus, label: Text('送转')),
                  ButtonSegment(value: TradeEntryType.fee, label: Text('费用')),
                ],
                selected: {type},
                onSelectionChanged: (value) =>
                    setState(() => type = value.single),
              ),
              const SizedBox(height: 12),
              if (type != TradeEntryType.fee) ...[
                _field('trade-code', '股票代码', 'code'),
                _field('trade-name', '股票名称', 'name'),
              ],
              if (type == TradeEntryType.buy ||
                  type == TradeEntryType.sell ||
                  type == TradeEntryType.bonus)
                _field('trade-quantity', '数量', 'quantity', numeric: true),
              if (type == TradeEntryType.buy || type == TradeEntryType.sell)
                _field('trade-price', '成交价格', 'price', numeric: true),
              if (type == TradeEntryType.buy ||
                  type == TradeEntryType.sell ||
                  type == TradeEntryType.fee)
                _field('trade-fee', '费用', 'fee', numeric: true),
              if (type == TradeEntryType.dividend)
                _field('trade-cash', '分红金额', 'cash', numeric: true),
              if (type == TradeEntryType.fee)
                _field('trade-note', '费用说明', 'note'),
              const SizedBox(height: 12),
              FilledButton(onPressed: _save, child: const Text('保存')),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    String keyName,
    String label,
    String fieldName, {
    bool numeric = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        key: Key(keyName),
        keyboardType: numeric
            ? const TextInputType.numberWithOptions(decimal: true)
            : null,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        onChanged: (value) => fields[fieldName] = value,
      ),
    );
  }

  void _save() {
    Navigator.pop(
      context,
      _TradeDraft(
        type: type,
        code: fields['code'] ?? '',
        name: fields['name'] ?? '',
        quantity: int.tryParse(fields['quantity'] ?? '') ?? 0,
        price: double.tryParse(fields['price'] ?? '') ?? 0,
        fee: double.tryParse(fields['fee'] ?? '') ?? 0,
        cashAmount: double.tryParse(fields['cash'] ?? '') ?? 0,
        note: fields['note'] ?? '',
      ),
    );
  }
}

class _TradeDraft {
  const _TradeDraft({
    required this.type,
    required this.code,
    required this.name,
    required this.quantity,
    required this.price,
    required this.fee,
    required this.cashAmount,
    required this.note,
  });

  final TradeEntryType type;
  final String code;
  final String name;
  final int quantity;
  final double price;
  final double fee;
  final double cashAmount;
  final String note;
}
