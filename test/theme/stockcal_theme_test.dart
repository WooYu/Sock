import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/core/display.dart';
import 'package:stockcal/theme/stockcal_theme.dart';

void main() {
  testWidgets('dark theme is deep-space tech with red-up green-down',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.dark),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).brightness, Brightness.dark);
    expect(Theme.of(context).scaffoldBackgroundColor, const Color(0xFF0A0E15));
    expect(Theme.of(context).colorScheme.primary, const Color(0xFF38C3E0));
    expect(gainColor(context), const Color(0xFFF0525D));
    expect(lossColor(context), const Color(0xFF2BB673));
  });

  testWidgets('light theme is deep-space light with red-up green-down', (
    tester,
  ) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.light),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).scaffoldBackgroundColor, const Color(0xFFEEF1F6));
    expect(Theme.of(context).colorScheme.primary, const Color(0xFF0E9CC4));
    expect(gainColor(context), const Color(0xFFD63A48));
    expect(lossColor(context), const Color(0xFF1E9E63));
  });
}
