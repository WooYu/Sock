import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/chart/chart_annotations.dart';
import 'package:stockcal/features/chart/persistent_chart_annotation_store.dart';
import 'package:stockcal/features/sync/remote_sync_service.dart';

void main() {
  test(
    'uploads pending annotation mutation and acknowledges success',
    () async {
      SharedPreferences.setMockInitialValues({});
      final store = PersistentChartAnnotationStore();
      await store.add(
        PendingAnnotationMutation(
          idempotencyKey: 'annotation:a1:2:delete',
          annotationId: 'a1',
          stockCode: '600519',
          operation: AnnotationOperation.delete,
          revision: 2,
          updatedAt: DateTime.utc(2026, 8, 14),
        ),
      );
      final service = RemoteSyncService(
        baseUrl: Uri.parse('https://api.stockcal.test'),
        client: MockClient((request) async {
          final body = jsonDecode(request.body) as Map<String, Object?>;
          expect(body['operation'], 'DELETE');
          expect(body['revision'], 2);
          expect(request.headers['authorization'], 'Bearer access');
          return http.Response('{"applied":true,"cursor":4}', 200);
        }),
      );

      final result = await AnnotationSyncWorker(
        store: store,
        remote: service,
      ).drain('access');

      expect(result.uploaded, 1);
      expect(await store.loadPending(), isEmpty);
    },
  );
}
