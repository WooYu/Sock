import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/core/display.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/theme/stockcal_theme.dart';

void main() {
  testWidgets('浅色主题取原型取值，且挂载 token 扩展', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildStockCalTheme(Brightness.light),
        home: const Scaffold(body: SizedBox()),
      ),
    );
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).scaffoldBackgroundColor, const Color(0xFFF5F6F8));
    expect(Theme.of(context).colorScheme.primary, const Color(0xFF4057E8));
    expect(StockCalTokens.of(context).canvas, const Color(0xFFF5F6F8));
    // 行情方向：红涨绿跌，语义未变
    expect(gainColor(context), const Color(0xFFE94052));
    expect(lossColor(context), const Color(0xFF0A9F6F));
    // 损益金额：绿盈红亏，与行情方向极性相反
    expect(profitColor(context), const Color(0xFF27875D));
    expect(lossAmountColor(context), const Color(0xFFD24A55));
  });

  testWidgets('深色主题挂载 token 扩展且槽位可读', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildStockCalTheme(Brightness.dark),
        home: const Scaffold(body: SizedBox()),
      ),
    );
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).brightness, Brightness.dark);
    expect(
      Theme.of(context).scaffoldBackgroundColor,
      StockCalTokens.dark().canvas,
    );
    expect(StockCalTokens.of(context).accent, StockCalTokens.dark().accent);
  });

  testWidgets('pnlColor 行为未变：仍走行情方向色', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildStockCalTheme(Brightness.light),
        home: const Scaffold(body: SizedBox()),
      ),
    );
    final context = tester.element(find.byType(Scaffold));
    expect(pnlColor(context, 1), gainColor(context));
    expect(pnlColor(context, -1), lossColor(context));
    expect(pnlColor(context, 0), isNull);
  });
}
