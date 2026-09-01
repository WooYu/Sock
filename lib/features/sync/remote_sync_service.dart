import 'dart:convert';

import 'package:http/http.dart' as http;

import '../chart/chart_annotations.dart';

class RemoteSyncException implements Exception {
  const RemoteSyncException(this.statusCode, this.message);
  final int statusCode;
  final String message;
}

class RemoteSyncService {
  RemoteSyncService({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  final Uri baseUrl;
  final http.Client _client;

  Future<void> uploadAnnotation(
    String accessToken,
    PendingAnnotationMutation mutation,
  ) async {
    final response = await _client.post(
      baseUrl.resolve('/api/v1/sync/mutations'),
      headers: {
        'authorization': 'Bearer $accessToken',
        'content-type': 'application/json',
      },
      body: jsonEncode({
        'idempotencyKey': mutation.idempotencyKey,
        'entityType': 'CHART_WORKSPACE',
        'entityId': '${mutation.stockCode}:day',
        'operation': mutation.operation == AnnotationOperation.delete
            ? 'DELETE'
            : 'UPSERT',
        'revision': mutation.revision,
        'payload': {
          'version': 1,
          'stockCode': mutation.stockCode,
          'period': 'day',
          'drawings': mutation.annotation == null ? <Object?>[] : [chartAnnotationToJson(mutation.annotation!)],
          'indicators': <String, bool>{},
          'indicatorConfig': <String, Object?>{},
          'layers': <String, bool>{},
          'view': {'zoom': 100, 'panX': 0, 'panY': 0},
          'crosshair': false,
          'updatedAt': mutation.updatedAt.toIso8601String(),
          'revision': mutation.revision,
        },
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RemoteSyncException(response.statusCode, response.body);
    }
  }

  Future<SyncPullResult> pullAnnotations(
    String accessToken,
    int cursor,
    String stockCode,
  ) async {
    final response = await _client.get(
      baseUrl.resolve('/api/v1/sync/changes?cursor=$cursor'),
      headers: {'authorization': 'Bearer $accessToken'},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RemoteSyncException(response.statusCode, response.body);
    }
    final json = jsonDecode(response.body) as Map<String, Object?>;
    final changes = json['changes']! as List<Object?>;
    final annotations = changes.map((item) {
      final change = item! as Map<String, Object?>;
      final payload = change['payload'] as Map<String, Object?>?;
      final drawings = payload?['drawings'] as List<Object?>?;
      return drawings?.map((drawing) => chartAnnotationFromJson(drawing! as Map<String, Object?>)).toList() ?? const <ChartAnnotation>[];
    }).expand((items) => items).where((item) => item.stockCode == stockCode).toList(growable: false);
    return SyncPullResult(nextCursor: json['nextCursor']! as int, annotations: annotations);
  }
}

class SyncPullResult {
  const SyncPullResult({required this.nextCursor, required this.annotations});
  final int nextCursor;
  final List<ChartAnnotation> annotations;
}

class SyncDrainResult {
  const SyncDrainResult({required this.uploaded, required this.remaining});
  final int uploaded;
  final int remaining;
}

class AnnotationSyncWorker {
  const AnnotationSyncWorker({required this.store, required this.remote});

  final ChartAnnotationOutbox store;
  final RemoteSyncService remote;

  Future<SyncPullResult> pull(
    String accessToken,
    int cursor,
    String stockCode,
    ChartAnnotationController controller,
  ) async {
    final result = await remote.pullAnnotations(accessToken, cursor, stockCode);
    await controller.mergeRemote(result.annotations);
    return result;
  }

  Future<SyncDrainResult> drain(String accessToken) async {
    final pending = await store.loadPending();
    var uploaded = 0;
    for (final mutation in pending) {
      try {
        await remote.uploadAnnotation(accessToken, mutation);
        await store.acknowledge(mutation.idempotencyKey);
        uploaded += 1;
      } on RemoteSyncException {
        break;
      } on http.ClientException {
        break;
      }
    }
    return SyncDrainResult(
      uploaded: uploaded,
      remaining: (await store.loadPending()).length,
    );
  }
}
