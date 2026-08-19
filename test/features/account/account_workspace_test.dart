import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/account/account_workspace.dart';
import 'package:stockcal/features/account/remote_auth_service.dart';
import 'package:stockcal/features/account/session.dart';

void main() {
  testWidgets('requests a code and starts the resend countdown', (
    tester,
  ) async {
    var requests = 0;
    final controller = SessionController(
      MemorySessionRepository(),
      remote: RemoteAuthService(
        baseUrl: Uri.parse('https://api.stockcal.test'),
        client: MockClient((request) async {
          requests += 1;
          return http.Response('', 202);
        }),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AccountWorkspace(controller: controller)),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextFormField, '手机号'),
      '13800138000',
    );
    await tester.tap(find.text('获取验证码'));
    await tester.pump();

    expect(requests, 1);
    expect(find.text('验证码已发送（开发模式验证码：000000）'), findsOneWidget);
    expect(find.text('60 秒后重发'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('signs in by phone and shows profile devices and sync', (
    tester,
  ) async {
    final controller = SessionController(MemorySessionRepository());
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AccountWorkspace(controller: controller)),
      ),
    );

    expect(find.text('A 股决策日志 · 手机号登录'), findsOneWidget);
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
    expect(find.text('A 股决策日志 · 手机号登录'), findsOneWidget);
    expect(controller.session, isNull);
  });

  testWidgets('shows and revokes a non-current device', (tester) async {
    final controller = SessionController(MemorySessionRepository());
    await controller.verifyPhone(phone: '13800138000', code: '123456');
    controller.registerDevice(
      const UserDevice(id: 'web-1', name: 'Chrome Web', isCurrent: false),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AccountWorkspace(controller: controller)),
      ),
    );

    expect(find.text('Chrome Web'), findsOneWidget);
    await tester.tap(find.byTooltip('撤销 Chrome Web'));
    await tester.pumpAndSettle();

    expect(find.text('Chrome Web'), findsNothing);
  });

  testWidgets('shows an error message when the login request fails', (
    tester,
  ) async {
    final controller = SessionController(
      MemorySessionRepository(),
      remote: RemoteAuthService(
        baseUrl: Uri.parse('https://api.stockcal.test'),
        client: MockClient((request) async {
          throw http.ClientException('Failed to fetch');
        }),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AccountWorkspace(controller: controller)),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextFormField, '手机号'),
      '13800138000',
    );
    await tester.enterText(find.widgetWithText(TextFormField, '验证码'), '123456');
    await tester.tap(find.text('登录'));
    await tester.pumpAndSettle();

    expect(find.text('无法连接服务器，请检查网络后重试'), findsOneWidget);
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
