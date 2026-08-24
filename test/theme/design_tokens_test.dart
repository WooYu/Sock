import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';

void main() {
  group('StockCalTokens.light 逐值等于原型取值', () {
    final t = StockCalTokens.light();

    test('底与面', () {
      expect(t.canvas, const Color(0xFFF5F6F8));
      expect(t.surface, const Color(0xFFFFFFFF));
      expect(t.surfaceSunken, const Color(0xFFFBFCFE));
      expect(t.surfaceHeader, const Color(0xFFF7F8FB));
      expect(t.surfaceInset, const Color(0xFFEEF0F4));
    });

    test('线', () {
      expect(t.line, const Color(0xFFE7E9EF));
      expect(t.softLine, const Color(0xFFEEF0F5));
      expect(t.tileLine, const Color(0xFFE3E6ED));
    });

    test('字', () {
      expect(t.ink, const Color(0xFF172033));
      expect(t.muted, const Color(0xFF6C7486));
      expect(t.faint, const Color(0xFF9299A8));
      expect(t.eyebrowInk, const Color(0xFF9198A7));
    });

    test('行情方向：红涨绿跌', () {
      expect(t.rise, const Color(0xFFE94052));
      expect(t.riseSoft, const Color(0xFFFFF1F2));
      expect(t.fall, const Color(0xFF0A9F6F));
      expect(t.fallSoft, const Color(0xFFEAF9F3));
    });

    test('损益金额：绿盈红亏，与行情方向极性相反', () {
      expect(t.profit, const Color(0xFF27875D));
      expect(t.profitSoft, const Color(0xFFEEFAF3));
      expect(t.loss, const Color(0xFFD24A55));
      expect(t.lossSoft, const Color(0xFFFFF1F2));
      expect(t.profit, isNot(t.rise));
      expect(t.loss, isNot(t.fall));
    });

    test('强调', () {
      expect(t.accent, const Color(0xFF4057E8));
      expect(t.accentSoft, const Color(0xFFEDF0FF));
      expect(t.amber, const Color(0xFFE39B2E));
      expect(t.amberSoft, const Color(0xFFFFF8E9));
    });

    test('K 线指标调色板', () {
      expect(t.indicators.ma5, const Color(0xFFD6A12A));
      expect(t.indicators.ma10, const Color(0xFF4E9BD6));
      expect(t.indicators.ma20, const Color(0xFFA46EE8));
      expect(t.indicators.ma30, const Color(0xFFD56C9A));
      expect(t.indicators.ma60, const Color(0xFF45A88B));
      expect(t.indicators.ma120, const Color(0xFFE17B43));
      expect(t.indicators.ma250, const Color(0xFF65738A));
      expect(t.indicators.boll, const Color(0xFF6678E5));
    });
  });

  test('dark 槽位齐全（取值为过渡值，不断言具体色）', () {
    final d = StockCalTokens.dark();
    expect(d.canvas, isNot(StockCalTokens.light().canvas));
    expect(d.riseSoft, isNotNull);
    expect(d.fallSoft, isNotNull);
    expect(d.profitSoft, isNotNull);
    expect(d.lossSoft, isNotNull);
    expect(
      d.indicators.ma5,
      StockCalTokens.light().indicators.ma5,
      reason: '指标调色板深浅共用',
    );
  });

  test('ThemeExtension 契约：lerp 与 copyWith', () {
    final l = StockCalTokens.light();
    final d = StockCalTokens.dark();
    expect(l.lerp(d, 0).canvas, l.canvas);
    expect(l.lerp(d, 1).canvas, d.canvas);
    expect(l.lerp(null, 0.5), l);
    expect(
      l.copyWith(accent: const Color(0xFF123456)).accent,
      const Color(0xFF123456),
    );
    expect(l.copyWith().canvas, l.canvas);
  });

  testWidgets('可经 Theme 取出', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(extensions: [StockCalTokens.light()]),
        home: const Scaffold(body: SizedBox()),
      ),
    );
    final ctx = tester.element(find.byType(Scaffold));
    expect(StockCalTokens.of(ctx).accent, const Color(0xFF4057E8));
  });

  test('字号阶与圆角', () {
    expect(StockCalType.eyebrow, 9);
    expect(StockCalType.micro, 10, reason: '原型 8px 抬到 10，唯一偏离处');
    expect(StockCalType.h2, 18);
    expect(StockCalRadii.panel, 11);
    expect(StockCalRadii.tile, 7);
  });
}
