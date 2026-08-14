import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/admin/settings_data_service.dart';

void main() {
  test('exports and restores only StockCal local data', () async {
    SharedPreferences.setMockInitialValues({
      'stockcal.portfolio.v1': '{"entries":[]}',
      'stockcal.notifications': true,
      'unrelated.key': 'keep-me',
    });
    final service = SettingsDataService();

    final archive = await service.exportArchive();
    final decoded = jsonDecode(archive) as Map<String, Object?>;

    expect(decoded['version'], 1);
    expect((decoded['data']! as Map<String, Object?>).keys, {
      'stockcal.portfolio.v1',
      'stockcal.notifications',
    });

    await service.clearLocalData();
    expect(
      (await SharedPreferences.getInstance()).getString('unrelated.key'),
      'keep-me',
    );
    await service.restoreArchive(archive);
    final preferences = await SharedPreferences.getInstance();
    expect(preferences.getString('stockcal.portfolio.v1'), '{"entries":[]}');
    expect(preferences.getBool('stockcal.notifications'), isTrue);
  });

  test(
    'backup can be read without including itself in future exports',
    () async {
      SharedPreferences.setMockInitialValues({'stockcal.watchlist.v1': '[]'});
      final service = SettingsDataService();

      await service.backup();
      final backup = await service.latestBackup();

      expect(backup, isNotNull);
      final data = (jsonDecode(backup!)['data'] as Map<String, Object?>);
      expect(data['stockcal.watchlist.v1'], '[]');
      expect(data.containsKey('stockcal.backup.v1'), isFalse);
    },
  );
}
