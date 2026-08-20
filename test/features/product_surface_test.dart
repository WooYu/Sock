import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('main product surface exposes the four primary tabs', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const StockCalApp());

    expect(find.text('行情'), findsOneWidget);
    expect(find.text('自选'), findsOneWidget);
    expect(find.text('组合'), findsOneWidget);
    expect(find.text('我的'), findsOneWidget);
  });

  testWidgets('module navigation switches to backtest and review workspaces', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const StockCalApp());
    await tester.pumpAndSettle();

    // 默认「行情」tab 显示搜索框与未登录提示
    expect(find.text('搜索 A 股'), findsOneWidget);
    expect(find.textContaining('请先登录后查看行情'), findsOneWidget);

    await tester.tap(find.text('我的'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('规则回测'));
    await tester.pumpAndSettle();
    expect(find.textContaining('请先登录后查看行情'), findsOneWidget);

    await tester.tap(find.text('我的'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('复盘 AI'));
    await tester.pumpAndSettle();
    expect(find.text('暂无复盘记录'), findsOneWidget);
    expect(find.text('请先在组合交易中记录买卖'), findsOneWidget);
  });
}
