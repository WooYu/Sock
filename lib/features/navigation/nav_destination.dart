import 'package:flutter/material.dart';

class NavDestination {
  const NavDestination({
    required this.key,
    required this.title,
    required this.icon,
  });

  final String key;
  final String title;
  final IconData icon;
}

/// 主导航目的地，命名完全照参考站 KEYLINE。
const navDestinations = <NavDestination>[
  NavDestination(
    key: 'overview',
    title: '组合总览',
    icon: Icons.dashboard_outlined,
  ),
  NavDestination(
    key: 'key-levels',
    title: '关键位分析',
    icon: Icons.candlestick_chart_outlined,
  ),
  NavDestination(
    key: 'patterns',
    title: '盈利模式',
    icon: Icons.auto_graph_outlined,
  ),
  NavDestination(
    key: 'future',
    title: '未来指标',
    icon: Icons.insights_outlined,
  ),
  NavDestination(key: 'predictions', title: '预测记录', icon: Icons.history),
  NavDestination(
    key: 'trades',
    title: '交易与盈亏',
    icon: Icons.account_balance_wallet_outlined,
  ),
  NavDestination(
    key: 'charts',
    title: '统计图表',
    icon: Icons.bar_chart_outlined,
  ),
  NavDestination(
    key: 'review',
    title: '当日复盘',
    icon: Icons.rate_review_outlined,
  ),
  NavDestination(
    key: 'ai-strategy',
    title: 'AI策略',
    icon: Icons.psychology_outlined,
  ),
  NavDestination(
    key: 'rules',
    title: '经验规则',
    icon: Icons.library_books_outlined,
  ),
];
