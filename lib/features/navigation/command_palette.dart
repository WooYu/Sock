import 'package:flutter/material.dart';

import '../market/market_data.dart';
import 'nav_destination.dart';

/// ⌘K 命令面板：搜索页面或股票，回车跳转。
class CommandPalette extends StatefulWidget {
  const CommandPalette({
    super.key,
    required this.onNavigate,
    required this.catalog,
    this.onSelectStock,
  });

  final ValueChanged<String> onNavigate;
  final StockCatalog catalog;
  final ValueChanged<Security>? onSelectStock;

  @override
  State<CommandPalette> createState() => _CommandPaletteState();
}

class _CommandPaletteState extends State<CommandPalette> {
  String _query = '';
  late Future<List<Security>> _results;

  @override
  void initState() {
    super.initState();
    _results = widget.catalog.search('');
  }

  void _onChanged(String value) {
    setState(() {
      _query = value;
      _results = widget.catalog.search(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final matches = navDestinations
        .where((d) => d.title.contains(_query) || d.key.contains(_query))
        .toList();
    return AlertDialog(
      contentPadding: EdgeInsets.zero,
      content: SizedBox(
        width: 440,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                autofocus: true,
                onChanged: _onChanged,
                decoration: const InputDecoration(
                  hintText: '搜索页面或股票…',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final d in matches)
                    ListTile(
                      leading: Icon(d.icon),
                      title: Text(d.title),
                      onTap: () {
                        Navigator.of(context).pop();
                        widget.onNavigate(d.key);
                      },
                    ),
                  FutureBuilder<List<Security>>(
                    future: _results,
                    builder: (context, snapshot) {
                      if (!snapshot.hasData) return const SizedBox.shrink();
                      return Column(
                        children: [
                          for (final s in snapshot.data!.take(8))
                            ListTile(
                              leading: const Icon(
                                Icons.candlestick_chart_outlined,
                              ),
                              title: Text(s.name),
                              subtitle: Text(s.code),
                              onTap: () {
                                Navigator.of(context).pop();
                                final cb = widget.onSelectStock;
                                if (cb != null) {
                                  cb(s);
                                } else {
                                  widget.onNavigate('key-levels');
                                }
                              },
                            ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
