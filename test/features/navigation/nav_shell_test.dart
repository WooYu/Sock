import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/navigation/app_shell.dart';
import 'package:stockcal/features/navigation/nav_destination.dart';

void main() {
  test('navDestinations follow reference site naming', () {
    expect(
      navDestinations.map((d) => d.title).toList(),
      const [
        '组合总览',
        '关键位分析',
        '盈利模式',
        '未来指标',
        '预测记录',
        '交易与盈亏',
        '统计图表',
        '当日复盘',
        'AI策略',
        '经验规则',
      ],
    );
  });

  testWidgets('AppShell renders destinations and content', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AppShell(
          destinations: navDestinations,
          selected: 'key-levels',
          onSelected: (_) {},
          content: const Text('content'),
          accountMenu: const Icon(Icons.account_circle_outlined),
          onOpenPalette: () {},
        ),
      ),
    );
    expect(find.text('关键位分析'), findsWidgets);
    expect(find.text('组合总览'), findsOneWidget);
    expect(find.text('content'), findsOneWidget);
  });
}
