import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/widgets/empty_state.dart';
import 'package:stockcal/widgets/error_state.dart';
import 'package:stockcal/widgets/metric_card.dart';
import 'package:stockcal/widgets/skeleton.dart';

void main() {
  testWidgets('MetricCard renders label and value', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: MetricCard(label: '总资产', value: '¥100.00')),
    ));
    expect(find.text('总资产'), findsOneWidget);
    expect(find.text('¥100.00'), findsOneWidget);
  });

  testWidgets('EmptyState shows action button and fires callback', (tester) async {
    var tapped = false;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: EmptyState(
          icon: Icons.bookmark_border,
          title: '暂无自选',
          actionLabel: '去添加',
          onAction: () => tapped = true,
        ),
      ),
    ));
    await tester.tap(find.text('去添加'));
    expect(tapped, isTrue);
  });

  testWidgets('ErrorState shows retry and fires callback', (tester) async {
    var retried = false;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ErrorState(message: '加载失败', onRetry: () => retried = true),
      ),
    ));
    await tester.tap(find.text('重试'));
    expect(retried, isTrue);
  });

  testWidgets('Skeleton renders a box', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: Skeleton(height: 20)),
    ));
    expect(find.byType(Skeleton), findsOneWidget);
  });
}
