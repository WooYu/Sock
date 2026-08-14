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

  Map<String, Object?> _annotationToJson(ChartAnnotation item) => {
    'id': item.id,
    'stockCode': item.stockCode,
    'type': item.type.name,
    'points': [
      for (final point in item.points)
        {'candleIndex': point.candleIndex, 'price': point.price},
    ],
    'hidden': item.hidden,
    'updatedAt': item.updatedAt.toIso8601String(),
    'revision': item.revision,
  };

  ChartAnnotation _annotationFromJson(Map<String, Object?> json) {
    final points = json['points']! as List<Object?>;
    return ChartAnnotation(
      id: json['id']! as String,
      stockCode: json['stockCode']! as String,
      type: ChartAnnotationType.values.byName(json['type']! as String),
      points: points
          .map((item) {
            final point = item! as Map<String, Object?>;
            return ChartPoint(
              candleIndex: point['candleIndex']! as int,
              price: (point['price']! as num).toDouble(),
            );
          })
          .toList(growable: false),
      hidden: json['hidden']! as bool,
      updatedAt: DateTime.parse(json['updatedAt']! as String),
      revision: json['revision']! as int,
    );
  }

  Map<String, Object?> _mutationToJson(PendingAnnotationMutation item) => {
    'idempotencyKey': item.idempotencyKey,
    'annotationId': item.annotationId,
    'stockCode': item.stockCode,
    'operation': item.operation.name,
    'revision': item.revision,
    'updatedAt': item.updatedAt.toIso8601String(),
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
    );
  }
}
