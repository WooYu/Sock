import 'dart:async';

import 'package:flutter/material.dart';

import '../../widgets/skeleton.dart';
import '../market/market_data.dart';
import 'watchlist.dart';

class WatchlistScreen extends StatefulWidget {
  const WatchlistScreen({
    super.key,
    required this.controller,
    required this.catalog,
  });

  final WatchlistController controller;
  final StockCatalog catalog;

  @override
  State<WatchlistScreen> createState() => _WatchlistScreenState();
}

class _WatchlistScreenState extends State<WatchlistScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
    widget.controller.load();
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
    final outbox = widget.controller.outbox;
    final pending = outbox is MemoryMutationOutbox ? outbox.pending.length : 0;

    return Material(
      color: Colors.transparent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 8, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '自选股',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                IconButton(
                  tooltip: '新建自选分组',
                  onPressed: _createGroup,
                  icon: const Icon(Icons.create_new_folder_outlined),
                ),
              ],
            ),
          ),
          Expanded(
            child: widget.controller.groups.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.bookmark_border, size: 40),
                        const SizedBox(height: 12),
                        const Text('还没有自选分组'),
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: _createGroup,
                          icon: const Icon(Icons.add),
                          label: const Text('新建分组'),
                        ),
                      ],
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Chip(
                          avatar: const Icon(
                            Icons.cloud_upload_outlined,
                            size: 18,
                          ),
                          label: Text('待同步 $pending 项'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      for (final group in widget.controller.groups)
                        _GroupSection(
                          group: group,
                          onAdd: () => _addStock(group.id),
                          onRemove: (code) => widget.controller.removeStock(
                            groupId: group.id,
                            code: code,
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Future<void> _createGroup() async {
    var groupName = '';
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('新建自选分组'),
        content: TextField(
          key: const Key('group-name-field'),
          autofocus: true,
          onChanged: (value) => groupName = value,
          decoration: const InputDecoration(labelText: '分组名称'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, groupName.trim()),
            child: const Text('创建'),
          ),
        ],
      ),
    );
    if (name != null && name.isNotEmpty) {
      await widget.controller.createGroup(name);
    }
  }

  Future<void> _addStock(String groupId) async {
    final selected = await showModalBottomSheet<WatchStock>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _StockPicker(catalog: widget.catalog),
    );
    if (selected != null) {
      await widget.controller.addStock(groupId: groupId, stock: selected);
    }
  }
}

class _GroupSection extends StatelessWidget {
  const _GroupSection({
    required this.group,
    required this.onAdd,
    required this.onRemove,
  });

  final WatchGroup group;
  final VoidCallback onAdd;
  final ValueChanged<String> onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                group.name,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton(
              tooltip: '添加股票',
              onPressed: onAdd,
              icon: const Icon(Icons.add_circle_outline),
            ),
          ],
        ),
        if (group.stocks.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text('分组为空，添加一只股票开始跟踪'),
          )
        else
          for (final stock in group.stocks)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(stock.name),
              subtitle: Text(stock.code),
              trailing: IconButton(
                tooltip: '移除 ${stock.name}',
                onPressed: () => onRemove(stock.code),
                icon: const Icon(Icons.remove_circle_outline),
              ),
            ),
        const Divider(),
      ],
    );
  }
}

class _StockPicker extends StatefulWidget {
  const _StockPicker({required this.catalog});

  final StockCatalog catalog;

  @override
  State<_StockPicker> createState() => _StockPickerState();
}

class _StockPickerState extends State<_StockPicker> {
  var query = '';
  Timer? _debounce;
  late Future<List<Security>> _results = Future.value(const []);

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      setState(() {
        query = value.trim();
        _results = widget.catalog.search(query);
      });
    });
  }

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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('添加股票', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextField(
              key: const Key('stock-search-field'),
              autofocus: true,
              onChanged: _onChanged,
              decoration: const InputDecoration(
                labelText: '代码、名称或拼音',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Flexible(
              child: FutureBuilder<List<Security>>(
                future: _results,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(child: Skeleton(height: 40)),
                    );
                  }
                  final results = snapshot.data ?? const <Security>[];
                  if (results.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(child: Text('未找到匹配股票')),
                    );
                  }
                  return ListView(
                    shrinkWrap: true,
                    children: [
                      for (final security in results)
                        ListTile(
                          minTileHeight: 56,
                          title: Text(security.name),
                          subtitle: Text(
                            '${security.code} · ${security.exchange}',
                          ),
                          onTap: () => Navigator.pop(
                            context,
                            WatchStock(
                              code: security.code,
                              name: security.name,
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
