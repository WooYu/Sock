import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/core/display.dart';
import 'package:stockcal/theme/stockcal_theme.dart';

void main() {
  testWidgets('dark theme uses financial background and sharp gain/loss colors',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.dark),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).brightness, Brightness.dark);
    expect(Theme.of(context).scaffoldBackgroundColor, const Color(0xFF000000));
    expect(Theme.of(context).colorScheme.primary, const Color(0xFF1D9BF0));
    expect(gainColor(context), const Color(0xFFF91880));
    expect(lossColor(context), const Color(0xFF00BA7C));
  });

  testWidgets('light theme is X-style white with red-up green-down', (
    tester,
  ) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.light),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).scaffoldBackgroundColor, const Color(0xFFF7F9FA));
    expect(Theme.of(context).colorScheme.primary, const Color(0xFF1D9BF0));
    expect(gainColor(context), const Color(0xFFE0245E));
    expect(lossColor(context), const Color(0xFF0AA063));
  });
}
