import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/metric_strip.dart';

Widget _wrap(Widget child, {double width = 1200}) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

const _six = [
  MetricCell(label: '持仓股票', value: '3', unit: '只'),
  MetricCell(label: '总投入', value: '78570.00', unit: '元'),
  MetricCell(label: '当前市值', value: '79916.00', unit: '元'),
  MetricCell(
    label: '总浮动盈亏',
    value: '+1346.00',
    unit: '元',
    tone: MetricTone.profit,
  ),
  MetricCell(label: '已实现盈亏', value: '+84.00', unit: '元'),
  MetricCell(
    label: '组合收益率',
    value: '+1.82%',
    unit: '浮动 + 已实现',
    tone: MetricTone.profit,
  ),
];

void main() {
  final t = StockCalTokens.light();

  testWidgets('渲染全部格子的标签、数值、单位', (tester) async {
    await tester.pumpWidget(_wrap(const MetricStrip(cells: _six)));
    expect(find.text('持仓股票'), findsOneWidget);
    expect(find.text('78570.00'), findsOneWidget);
    expect(find.text('浮动 + 已实现'), findsOneWidget);
  });

  testWidgets('宽屏 6 列排成一行', (tester) async {
    await tester.pumpWidget(_wrap(const MetricStrip(cells: _six)));
    final rowY = tester.getTopLeft(find.text('持仓股票')).dy;
    expect(
      tester.getTopLeft(find.text('组合收益率')).dy,
      rowY,
      reason: '6 格应同在一行',
    );
  });

  testWidgets('窄屏塌为 2 列', (tester) async {
    await tester
        .pumpWidget(_wrap(const MetricStrip(cells: _six), width: 420));
    final first = tester.getTopLeft(find.text('持仓股票')).dy;
    final second = tester.getTopLeft(find.text('总投入')).dy;
    final third = tester.getTopLeft(find.text('当前市值')).dy;
    expect(second, first, reason: '前两格同行');
    expect(third, greaterThan(first), reason: '第三格换行');
  });

  testWidgets('末行不足列数时末格占满剩余宽度', (tester) async {
    const five = [
      MetricCell(label: '累计盈亏', value: '+552.00', unit: '元'),
      MetricCell(label: '盈利天数', value: '4 / 5', unit: '交易日'),
      MetricCell(label: '交易次数', value: '12', unit: '买卖合计'),
      MetricCell(label: '平均单笔', value: '46.00', unit: '元'),
      MetricCell(label: '执行偏差', value: '16.7%', unit: '未按计划'),
    ];
    await tester
        .pumpWidget(_wrap(const MetricStrip(cells: five), width: 420));
    final lastWidth = tester
        .getSize(
          find.ancestor(of: find.text('执行偏差'), matching: find.byType(MetricTile)),
        )
        .width;
    final firstWidth = tester
        .getSize(
          find.ancestor(of: find.text('累计盈亏'), matching: find.byType(MetricTile)),
        )
        .width;
    expect(lastWidth, greaterThan(firstWidth * 1.8));
  });

  testWidgets('tone 决定数值取色，全部来自 token', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MetricStrip(cells: [
          MetricCell(label: 'a', value: '1', tone: MetricTone.neutral),
          MetricCell(label: 'b', value: '2', tone: MetricTone.profit),
          MetricCell(label: 'c', value: '3', tone: MetricTone.loss),
          MetricCell(label: 'd', value: '4', tone: MetricTone.risk),
          MetricCell(label: 'e', value: '5', tone: MetricTone.accent),
        ]),
      ),
    );
    Color colorOf(String v) => tester.widget<Text>(find.text(v)).style!.color!;
    expect(colorOf('1'), t.ink);
    expect(colorOf('2'), t.profit);
    expect(colorOf('3'), t.loss);
    expect(colorOf('4'), t.loss);
    expect(colorOf('5'), t.accent);
  });

  testWidgets('格子背景与边框取 token', (tester) async {
    await tester.pumpWidget(_wrap(const MetricStrip(cells: _six)));
    final deco = tester
        .widget<Container>(
          find.descendant(
            of: find.byType(MetricTile).first,
            matching: find.byType(Container),
          ),
        )
        .decoration! as BoxDecoration;
    expect(deco.color, t.surfaceSunken);
    expect(deco.border!.top.color, t.tileLine);
  });
}
