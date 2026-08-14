import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/admin/remote_admin_service.dart';
import 'package:stockcal/features/admin/settings_admin_workspace.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/admin/settings_data_service.dart';

void main() {
  testWidgets('backup action persists an archive and confirms completion', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'stockcal.watchlist.v1': '[]'});
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: SettingsAdminWorkspace())),
    );

    await tester.tap(find.text('备份'));
    await tester.pumpAndSettle();

    expect(find.text('本地备份已保存'), findsOneWidget);
    expect(await SettingsDataService().latestBackup(), isNotNull);
  });

  testWidgets('remote administration renders server state instead of samples', (
    tester,
  ) async {
    final remote = RemoteAdminService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      accessToken: () => 'admin-token',
      client: MockClient((request) async {
        if (request.url.path.endsWith('/overview')) {
          return http.Response(
            jsonEncode({
              'marketStatus': 'Tushare 已连接',
              'secrets': [
                {'name': '短信服务', 'configured': false},
              ],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        if (request.url.path.endsWith('/jobs')) {
          return http.Response(
            '[{"id":"job-9","type":"MARKET_REPAIR","target":"600519","status":"FAILED","attempts":1,"error":"provider timeout","updatedAt":"2026-08-14T00:00:00Z"}]',
            200,
          );
        }
        return http.Response(
          '[{"id":"u9","phoneMasked":"139****9000","displayName":"管理员","role":"ADMIN","enabled":true}]',
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SettingsAdminWorkspace(remote: remote)),
      ),
    );

    await tester.tap(find.text('管理后台'));
    await tester.pumpAndSettle();

    expect(find.text('Tushare 已连接'), findsOneWidget);
    expect(find.text('MARKET_REPAIR'), findsOneWidget);
    expect(find.text('139****9000'), findsOneWidget);
    expect(find.text('网络超时'), findsNothing);
    await tester.drag(find.byType(ListView).last, const Offset(0, -650));
    await tester.pumpAndSettle();
    expect(find.text('未配置'), findsOneWidget);
  });

  testWidgets(
    'user settings expose indicators theme notifications and data actions',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: SettingsAdminWorkspace())),
      );

      expect(find.text('指标参数'), findsOneWidget);
      expect(find.text('复权方式'), findsOneWidget);
      expect(find.text('主题'), findsOneWidget);
      expect(find.text('通知偏好'), findsOneWidget);
      expect(find.text('导入数据'), findsOneWidget);
      expect(find.text('导出数据'), findsOneWidget);
      expect(find.text('备份'), findsOneWidget);
      await tester.drag(find.byType(ListView).first, const Offset(0, -300));
      await tester.pumpAndSettle();
      expect(find.text('注销账户'), findsOneWidget);
    },
  );

  testWidgets(
    'admin retries failed job repairs data and shows server-only secrets',
    (tester) async {
      tester.view.physicalSize = const Size(1100, 760);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: SettingsAdminWorkspace())),
      );

      await tester.tap(find.text('管理后台'));
      await tester.pumpAndSettle();
      expect(find.text('行情源状态'), findsOneWidget);
      expect(find.text('同步任务'), findsOneWidget);
      expect(find.text('用户与权限'), findsOneWidget);
      expect(find.text('规则模板'), findsOneWidget);
      expect(find.text('审计日志'), findsOneWidget);
      expect(find.text('AI 调用记录'), findsOneWidget);
      expect(find.text('服务端密钥'), findsOneWidget);
      expect(find.text('已配置'), findsWidgets);
      expect(find.text('server-secret'), findsNothing);

      await tester.tap(find.text('重试'));
      await tester.pumpAndSettle();
      expect(find.text('等待执行'), findsOneWidget);
      await tester.tap(find.text('修复数据'));
      await tester.pumpAndSettle();
      expect(find.text('修复任务已提交'), findsOneWidget);
    },
  );

  testWidgets('phone tabs have no horizontal overflow', (tester) async {
    tester.view.physicalSize = const Size(375, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: SettingsAdminWorkspace())),
    );
    await tester.pumpAndSettle();

    expect(find.byType(TabBar), findsOneWidget);
    expect(find.text('设置'), findsOneWidget);
    expect(find.text('管理后台'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
