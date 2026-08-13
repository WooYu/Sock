import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/account/account_workspace.dart';
import 'package:stockcal/features/account/session.dart';

void main() {
  testWidgets('signs in by phone and shows profile devices and sync', (
    tester,
  ) async {
    final controller = SessionController(MemorySessionRepository());
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AccountWorkspace(controller: controller)),
      ),
    );

    expect(find.text('手机验证码登录'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextFormField, '手机号'),
      '13800138000',
    );
    await tester.enterText(find.widgetWithText(TextFormField, '验证码'), '123456');
    await tester.tap(find.text('登录'));
    await tester.pumpAndSettle();

    expect(find.text('138****8000'), findsOneWidget);
    expect(find.text('设备管理'), findsOneWidget);
    expect(find.text('当前设备'), findsOneWidget);
    expect(find.text('同步状态'), findsOneWidget);
    expect(find.text('已同步'), findsOneWidget);
    expect(find.text('令牌有效'), findsOneWidget);
  });

  testWidgets('signs out and returns to verification form', (tester) async {
    final controller = SessionController(MemorySessionRepository());
    await controller.verifyPhone(phone: '13800138000', code: '123456');
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AccountWorkspace(controller: controller)),
      ),
    );

    await tester.tap(find.text('退出登录'));
    await tester.pumpAndSettle();
    expect(find.text('手机验证码登录'), findsOneWidget);
    expect(controller.session, isNull);
  });

  testWidgets('phone layout does not overflow', (tester) async {
    tester.view.physicalSize = const Size(375, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = SessionController(MemorySessionRepository());
    await controller.verifyPhone(phone: '13800138000', code: '123456');
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AccountWorkspace(controller: controller)),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
