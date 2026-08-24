import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/ledger_table.dart';

Widget _wrap(Widget child, {double width = 900}) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

final _columns = const [
  LedgerColumn('股票', 12),
  LedgerColumn('持仓/成本', 10),
  LedgerColumn('浮动盈亏', 9),
];

void main() {
  final t = StockCalTokens.light();

  testWidgets('渲染表头与行', (tester) async {
    await tester.pumpWidget(
      _wrap(
        LedgerTable(
          columns: _columns,
          rows: const [
            LedgerRow(cells: [Text('华芯动力'), Text('1500 股'), Text('+1170.00')]),
          ],
        ),
      ),
    );
    expect(find.text('股票'), findsOneWidget);
    expect(find.text('华芯动力'), findsOneWidget);
  });

  testWidgets('表头背景取 surfaceHeader', (tester) async {
    await tester.pumpWidget(
      _wrap(
        LedgerTable(
          columns: _columns,
          rows: const [
            LedgerRow(cells: [Text('a'), Text('b'), Text('c')]),
          ],
        ),
      ),
    );
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('ledger-head')))
        .decoration! as BoxDecoration;
    expect(deco.color, t.surfaceHeader);
  });

  testWidgets('列宽按 flex 权重分配', (tester) async {
    await tester.pumpWidget(
      _wrap(
        LedgerTable(
          columns: _columns,
          rows: const [
            LedgerRow(cells: [Text('a'), Text('b'), Text('c')]),
          ],
        ),
      ),
    );
    final w1 = tester.getSize(find.text('股票')).width;
    final w3 = tester.getSize(find.text('浮动盈亏')).width;
    expect(w1, greaterThan(w3), reason: 'flex 12 应宽于 flex 9');
  });

  testWidgets('行点击触发回调', (tester) async {
    var tapped = 0;
    await tester.pumpWidget(
      _wrap(
        LedgerTable(
          columns: _columns,
          rows: [
            LedgerRow(
              cells: const [Text('a'), Text('b'), Text('c')],
              onTap: () => tapped++,
            ),
          ],
        ),
      ),
    );
    await tester.tap(find.text('a'));
    await tester.pump();
    expect(tapped, 1);
  });

  testWidgets('无 onTap 的行不可点', (tester) async {
    await tester.pumpWidget(
      _wrap(
        LedgerTable(
          columns: _columns,
          rows: const [
            LedgerRow(cells: [Text('a'), Text('b'), Text('c')]),
          ],
        ),
      ),
    );
    expect(
      find.descendant(
        of: find.byType(LedgerTable),
        matching: find.byType(InkWell),
      ),
      findsNothing,
    );
  });

  testWidgets('容器边框与圆角取 token', (tester) async {
    await tester.pumpWidget(
      _wrap(
        LedgerTable(
          columns: _columns,
          rows: const [
            LedgerRow(cells: [Text('a'), Text('b'), Text('c')]),
          ],
        ),
      ),
    );
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('ledger-shell')))
        .decoration! as BoxDecoration;
    expect(deco.border!.top.color, t.tileLine);
    expect(deco.borderRadius, BorderRadius.circular(StockCalRadii.button));
  });
}
