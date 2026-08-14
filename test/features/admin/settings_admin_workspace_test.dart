import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/admin/remote_admin_service.dart';
import 'package:stockcal/features/admin/settings_admin_workspace.dart';
import 'package:stockcal/features/admin/archive_file_gateway.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/admin/settings_data_service.dart';
import 'package:stockcal/features/account/session.dart';
import 'package:stockcal/features/preferences/preferences_controller.dart';
import 'package:stockcal/features/preferences/preferences_repository.dart';
import 'package:stockcal/features/preferences/user_preferences.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  testWidgets('exports a copyable archive and imports it after validation', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'stockcal.watchlist.v1': '[]'});
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: SettingsAdminWorkspace())),
    );

    await tester.tap(find.text('导出数据'));
    await tester.pumpAndSettle();
    expect(find.text('StockCal 数据归档'), findsOneWidget);
    expect(find.textContaining('stockcal.watchlist.v1'), findsOneWidget);
    await tester.tap(find.text('关闭'));
    await tester.pumpAndSettle();

    final archive = await SettingsDataService().exportArchive();
    await SettingsDataService().clearLocalData();
    await tester.tap(find.text('导入数据'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), archive);
    await tester.tap(find.text('恢复数据'));
    await tester.pumpAndSettle();

    expect(find.text('数据已恢复，请重新打开页面'), findsOneWidget);
    expect(
      (await SharedPreferences.getInstance()).getString(
        'stockcal.watchlist.v1',
      ),
      '[]',
    );
  });

  testWidgets('account deletion requires confirmation and clears local data', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'stockcal.watchlist.v1': '[]'});
    final session = SessionController(MemorySessionRepository());
    await session.verifyPhone(phone: '13800138000', code: '123456');
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SettingsAdminWorkspace(sessionController: session),
        ),
      ),
    );
    await tester.drag(find.byType(ListView).first, const Offset(0, -400));
    await tester.pumpAndSettle();

    await tester.tap(find.text('注销账户'));
    await tester.pumpAndSettle();
    expect(find.textContaining('此操作不可撤销'), findsOneWidget);
    await tester.tap(find.text('确认注销'));
    await tester.pumpAndSettle();

    expect(session.session, isNull);
    expect(
      (await SharedPreferences.getInstance()).getString(
        'stockcal.watchlist.v1',
      ),
      isNull,
    );
    expect(find.text('账户与本地数据已删除'), findsOneWidget);
  });

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
        if (request.url.path.endsWith('/audit-logs')) {
          return http.Response(
            '[{"actor":"owner","action":"RETRY_ADMIN_JOB","target":"job-9","createdAt":"2026-08-14T00:00:00Z"}]',
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        if (request.url.path.endsWith('/ai-call-logs')) {
          return http.Response(
            '[{"actor":"user-1","purpose":"REVIEW_EXPLANATION","model":"gpt-4o-mini","status":"SUCCEEDED","createdAt":"2026-08-14T00:00:00Z"}]',
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
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

  testWidgets('theme and notification changes persist through preferences', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = PreferencesController(
      repository: PersistentPreferencesRepository(),
    );
    await controller.load();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SettingsAdminWorkspace(preferences: controller)),
      ),
    );

    await tester.tap(find.byKey(const Key('theme-selector')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('深色').last);
    await tester.pumpAndSettle();
    expect(controller.preferences.theme, ThemePreference.dark);

    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();
    expect(controller.preferences.notificationsEnabled, isFalse);
  });

  testWidgets('editing indicator parameters persists through preferences', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = PreferencesController(
      repository: PersistentPreferencesRepository(),
    );
    await controller.load();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SettingsAdminWorkspace(preferences: controller)),
      ),
    );

    await tester.tap(find.text('指标参数'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('ind-ma-short')), '3');
    await tester.enterText(find.byKey(const Key('ind-ma-long')), '10');
    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();

    expect(controller.preferences.indicatorSettings.maShortPeriod, 3);
    expect(controller.preferences.indicatorSettings.maLongPeriod, 10);
  });

  testWidgets('admin panel renders audit and AI call logs from the server', (
    tester,
  ) async {
    final remote = RemoteAdminService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      accessToken: () => 'admin-token',
      client: MockClient((request) async {
        final headers = {'content-type': 'application/json; charset=utf-8'};
        if (request.url.path.endsWith('/overview')) {
          return http.Response(
            jsonEncode({'marketStatus': '已连接', 'secrets': <Object>[]}),
            200,
            headers: headers,
          );
        }
        if (request.url.path.endsWith('/jobs')) return http.Response('[]', 200);
        if (request.url.path.endsWith('/users')) {
          return http.Response('[]', 200);
        }
        if (request.url.path.endsWith('/audit-logs')) {
          return http.Response(
            '[{"actor":"owner","action":"SET_USER_ROLE","target":"u1","createdAt":"2026-08-14T00:00:00Z"}]',
            200,
            headers: headers,
          );
        }
        if (request.url.path.endsWith('/ai-call-logs')) {
          return http.Response(
            '[{"actor":"user-1","purpose":"REVIEW_EXPLANATION","model":"gpt-4o-mini","status":"SUCCEEDED","createdAt":"2026-08-14T00:00:00Z"}]',
            200,
            headers: headers,
          );
        }
        return http.Response('[]', 200);
      }),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SettingsAdminWorkspace(remote: remote)),
      ),
    );

    await tester.tap(find.text('管理后台'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).last, const Offset(0, -400));
    await tester.pumpAndSettle();

    expect(find.text('SET_USER_ROLE'), findsOneWidget);
    expect(find.text('REVIEW_EXPLANATION'), findsOneWidget);
  });

  testWidgets('exports archive to a file through the file gateway', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'stockcal.watchlist.v1': '[]'});
    final gateway = _FakeArchiveFileGateway();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SettingsAdminWorkspace(fileGateway: gateway)),
      ),
    );

    await tester.tap(find.text('导出数据'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('保存到文件'));
    await tester.pumpAndSettle();

    expect(gateway.savedContent, contains('stockcal.watchlist.v1'));
    expect(gateway.savedFileName, startsWith('stockcal-backup-'));
    expect(find.text('归档已保存到文件'), findsOneWidget);
  });

  testWidgets('shares archive through the file gateway', (tester) async {
    SharedPreferences.setMockInitialValues({'stockcal.watchlist.v1': '[]'});
    final gateway = _FakeArchiveFileGateway();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SettingsAdminWorkspace(fileGateway: gateway)),
      ),
    );

    await tester.tap(find.text('导出数据'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('分享'));
    await tester.pumpAndSettle();

    expect(gateway.sharedContent, contains('stockcal.watchlist.v1'));
  });

  testWidgets('imports archive from a picked file through the file gateway', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'stockcal.watchlist.v1': '[]'});
    final archive = await SettingsDataService().exportArchive();
    await SettingsDataService().clearLocalData();
    final gateway = _FakeArchiveFileGateway()..pickedContent = archive;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SettingsAdminWorkspace(fileGateway: gateway)),
      ),
    );

    await tester.tap(find.text('导入数据'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('选择文件'));
    await tester.pumpAndSettle();

    expect(find.text('数据已恢复，请重新打开页面'), findsOneWidget);
    expect(
      (await SharedPreferences.getInstance()).getString(
        'stockcal.watchlist.v1',
      ),
      '[]',
    );
  });

  testWidgets('rule templates list system rules and toggle enabled state', (
    tester,
  ) async {
    final book = RuleBook.withSystemDefaults(idFactory: () => 'unused');
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SettingsAdminWorkspace(ruleBook: book),
        ),
      ),
    );

    await tester.tap(find.text('管理后台'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).last, const Offset(0, -500));
    await tester.pumpAndSettle();

    expect(find.text('趋势确认'), findsOneWidget);
    expect(find.text('成交量确认'), findsOneWidget);

    await tester.tap(find.byType(Switch).first);
    await tester.pumpAndSettle();

    expect(
      book.latestRules.firstWhere((rule) => rule.name == '趋势确认').enabled,
      isFalse,
    );
  });
}

class _FakeArchiveFileGateway implements ArchiveFileGateway {
  String? pickedContent;
  String? savedFileName;
  String? savedContent;
  String? sharedContent;

  @override
  Future<String?> pickContent() async => pickedContent;

  @override
  Future<void> save(String fileName, String content) async {
    savedFileName = fileName;
    savedContent = content;
  }

  @override
  Future<void> share(String content) async {
    sharedContent = content;
  }
}
