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
        'entityType': 'ANNOTATION',
        'entityId': mutation.annotationId,
        'operation': mutation.operation == AnnotationOperation.delete
            ? 'DELETE'
            : 'UPSERT',
        'revision': mutation.revision,
        'payload': {
          'stockCode': mutation.stockCode,
          'updatedAt': mutation.updatedAt.toIso8601String(),
        },
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RemoteSyncException(response.statusCode, response.body);
    }
  }
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
