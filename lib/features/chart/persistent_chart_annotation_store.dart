import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'chart_annotations.dart';

class PersistentChartAnnotationStore
    implements ChartAnnotationRepository, ChartAnnotationOutbox {
  static const _annotationsKey = 'stockcal.annotations.v1';
  static const _outboxKey = 'stockcal.annotation_outbox.v1';

  @override
  Future<List<ChartAnnotation>> load(String stockCode) async {
    final all = await _readList(_annotationsKey);
    return all
        .map(_annotationFromJson)
        .where((item) => item.stockCode == stockCode)
        .toList(growable: false);
  }

  @override
  Future<void> save(String stockCode, List<ChartAnnotation> annotations) async {
    final all = (await _readList(_annotationsKey))
        .map(_annotationFromJson)
        .where((item) => item.stockCode != stockCode)
        .followedBy(annotations)
        .map(_annotationToJson)
        .toList(growable: false);
    await _writeList(_annotationsKey, all);
  }

  @override
  Future<void> add(PendingAnnotationMutation mutation) async {
    final current = await loadPending();
    if (current.any((item) => item.idempotencyKey == mutation.idempotencyKey)) {
      return;
    }
    await _writeList(_outboxKey, [
      ...current.map(_mutationToJson),
      _mutationToJson(mutation),
    ]);
  }

  @override
  Future<List<PendingAnnotationMutation>> loadPending() async {
    return (await _readList(
      _outboxKey,
    )).map(_mutationFromJson).toList(growable: false);
  }

  @override
  Future<void> acknowledge(String idempotencyKey) async {
    final current = await loadPending();
    await _writeList(
      _outboxKey,
      current
          .where((item) => item.idempotencyKey != idempotencyKey)
          .map(_mutationToJson)
          .toList(growable: false),
    );
  }

  Future<List<Map<String, Object?>>> _readList(String key) async {
    final value = (await SharedPreferences.getInstance()).getString(key);
    if (value == null) return [];
    return (jsonDecode(value) as List<Object?>).cast<Map<String, Object?>>();
  }

  Future<void> _writeList(String key, List<Map<String, Object?>> value) async {
    await (await SharedPreferences.getInstance()).setString(
      key,
      jsonEncode(value),
    );
  }

  Map<String, Object?> _annotationToJson(ChartAnnotation item) => chartAnnotationToJson(item);

  ChartAnnotation _annotationFromJson(Map<String, Object?> json) => chartAnnotationFromJson(json);

  Map<String, Object?> _mutationToJson(PendingAnnotationMutation item) => {
    'idempotencyKey': item.idempotencyKey,
    'annotationId': item.annotationId,
    'stockCode': item.stockCode,
    'operation': item.operation.name,
    'revision': item.revision,
    'updatedAt': item.updatedAt.toIso8601String(),
    if (item.annotation != null) 'annotation': chartAnnotationToJson(item.annotation!),
  };

  PendingAnnotationMutation _mutationFromJson(Map<String, Object?> json) {
    return PendingAnnotationMutation(
      idempotencyKey: json['idempotencyKey']! as String,
      annotationId: json['annotationId']! as String,
      stockCode: json['stockCode']! as String,
      operation: AnnotationOperation.values.byName(
        json['operation']! as String,
      ),
      revision: json['revision']! as int,
      updatedAt: DateTime.parse(json['updatedAt']! as String),
      annotation: json['annotation'] == null
          ? null
          : chartAnnotationFromJson(json['annotation']! as Map<String, Object?>),
    );
  }
}
