import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main product surface exposes all planned modules', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const StockCalApp());

    expect(find.text('总览'), findsWidgets);
    expect(find.text('个股分析'), findsOneWidget);
    expect(find.text('专业K线'), findsOneWidget);
    expect(find.text('组合'), findsOneWidget);
    expect(find.text('更多'), findsOneWidget);

    await tester.tap(find.text('更多'));
    await tester.pumpAndSettle();
    expect(find.text('规则与回测'), findsOneWidget);
    expect(find.text('知识规则'), findsOneWidget);
    expect(find.text('复盘与 AI'), findsOneWidget);
    expect(find.text('设置'), findsOneWidget);
    expect(find.text('管理后台'), findsOneWidget);
  });

  testWidgets(
    'module navigation switches to analysis, backtest, and review workspaces',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(const StockCalApp());

      await tester.tap(find.text('个股分析'));
      await tester.pumpAndSettle();
      expect(find.text('搜索 A 股'), findsOneWidget);
      expect(find.textContaining('请先登录后查看行情'), findsOneWidget);

      await tester.tap(find.text('更多'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('规则与回测'));
      await tester.pumpAndSettle();
      expect(find.textContaining('请先登录后查看行情'), findsOneWidget);

      await tester.tap(find.text('更多'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('复盘与 AI'));
      await tester.pumpAndSettle();
      expect(find.text('暂无复盘记录'), findsOneWidget);
      expect(find.text('请先在组合交易中记录买卖'), findsOneWidget);
    },
  );
}
