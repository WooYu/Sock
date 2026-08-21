import 'package:flutter/material.dart';

import 'nav_destination.dart';

/// 应用外壳：顶栏（搜索 + 账户）+ 左侧导航 rail（桌面）/ drawer（移动）。
class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.destinations,
    required this.selected,
    required this.onSelected,
    required this.content,
    required this.accountMenu,
    required this.onOpenPalette,
  });

  final List<NavDestination> destinations;
  final String selected;
  final ValueChanged<String> onSelected;
  final Widget content;
  final Widget accountMenu;
  final VoidCallback onOpenPalette;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 600;
    final title = destinations
        .firstWhere((d) => d.key == selected, orElse: () => destinations.first)
        .title;

    if (wide) {
      return Column(
        children: [
          _TopBar(
            title: title,
            onOpenPalette: onOpenPalette,
            accountMenu: accountMenu,
          ),
          Expanded(
            child: Row(
              children: [
                _Rail(
                  destinations: destinations,
                  selected: selected,
                  onSelected: onSelected,
                ),
                Expanded(child: content),
              ],
            ),
          ),
        ],
      );
    }

    return Scaffold(
      drawer: Drawer(
        child: ListView(
          children: [
            for (final d in destinations)
              ListTile(
                leading: Icon(d.icon),
                title: Text(d.title),
                selected: selected == d.key,
                onTap: () {
                  Navigator.of(context).pop();
                  onSelected(d.key);
                },
              ),
          ],
        ),
      ),
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            tooltip: '搜索',
            onPressed: onOpenPalette,
            icon: const Icon(Icons.search),
          ),
          accountMenu,
        ],
      ),
      body: content,
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.title,
    required this.onOpenPalette,
    required this.accountMenu,
  });

  final String title;
  final VoidCallback onOpenPalette;
  final Widget accountMenu;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(width: 24),
            Expanded(
              child: InkWell(
                onTap: onOpenPalette,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.outline,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.search, size: 20),
                      const SizedBox(width: 8),
                      Text('搜索页面或股票…', style: TextStyle(color: muted)),
                      const Spacer(),
                      Text(
                        '⌘K',
                        style: TextStyle(color: muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            accountMenu,
          ],
        ),
      ),
    );
  }
}

class _Rail extends StatelessWidget {
  const _Rail({
    required this.destinations,
    required this.selected,
    required this.onSelected,
  });

  final List<NavDestination> destinations;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 224,
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            for (final d in destinations)
              ListTile(
                dense: true,
                leading: Icon(d.icon, size: 21),
                title: Text(d.title),
                selected: selected == d.key,
                onTap: () => onSelected(d.key),
              ),
          ],
        ),
      ),
    );
  }
}
