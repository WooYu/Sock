import 'package:flutter/foundation.dart';

enum ChartAnnotationType { trendLine, horizontalLine, rectangle, point }

class ChartPoint {
  const ChartPoint({required this.candleIndex, required this.price});

  final int candleIndex;
  final double price;

  ChartPoint move({required int candleDelta, required double priceDelta}) {
    return ChartPoint(
      candleIndex: candleIndex + candleDelta,
      price: price + priceDelta,
    );
  }
}

class ChartAnnotation {
  const ChartAnnotation({
    required this.id,
    required this.stockCode,
    required this.type,
    required this.points,
    required this.hidden,
    required this.updatedAt,
    required this.revision,
  });

  final String id;
  final String stockCode;
  final ChartAnnotationType type;
  final List<ChartPoint> points;
  final bool hidden;
  final DateTime updatedAt;
  final int revision;

  ChartAnnotation copyWith({
    List<ChartPoint>? points,
    bool? hidden,
    DateTime? updatedAt,
    int? revision,
  }) {
    return ChartAnnotation(
      id: id,
      stockCode: stockCode,
      type: type,
      points: points ?? this.points,
      hidden: hidden ?? this.hidden,
      updatedAt: updatedAt ?? this.updatedAt,
      revision: revision ?? this.revision,
    );
  }
}

abstract interface class ChartAnnotationRepository {
  Future<List<ChartAnnotation>> load(String stockCode);
  Future<void> save(String stockCode, List<ChartAnnotation> annotations);
}

class MemoryChartAnnotationRepository implements ChartAnnotationRepository {
  final Map<String, List<ChartAnnotation>> _byStock = {};

  @override
  Future<List<ChartAnnotation>> load(String stockCode) async {
    return List.of(_byStock[stockCode] ?? const []);
  }

  @override
  Future<void> save(String stockCode, List<ChartAnnotation> annotations) async {
    _byStock[stockCode] = List.of(annotations);
  }
}

enum AnnotationOperation { upsert, delete }

class PendingAnnotationMutation {
  const PendingAnnotationMutation({
    required this.idempotencyKey,
    required this.annotationId,
    required this.stockCode,
    required this.operation,
    required this.revision,
    required this.updatedAt,
  });

  final String idempotencyKey;
  final String annotationId;
  final String stockCode;
  final AnnotationOperation operation;
  final int revision;
  final DateTime updatedAt;
}

abstract interface class ChartAnnotationOutbox {
  Future<void> add(PendingAnnotationMutation mutation);
  Future<List<PendingAnnotationMutation>> loadPending();
  Future<void> acknowledge(String idempotencyKey);
}

class MemoryChartAnnotationOutbox implements ChartAnnotationOutbox {
  final List<PendingAnnotationMutation> _pending = [];

  List<PendingAnnotationMutation> get pending => List.unmodifiable(_pending);

  @override
  Future<List<PendingAnnotationMutation>> loadPending() async => pending;

  @override
  Future<void> acknowledge(String idempotencyKey) async {
    _pending.removeWhere((item) => item.idempotencyKey == idempotencyKey);
  }

  @override
  Future<void> add(PendingAnnotationMutation mutation) async {
    if (_pending.any(
      (item) => item.idempotencyKey == mutation.idempotencyKey,
    )) {
      return;
    }
    _pending.add(mutation);
  }
}

class ChartAnnotationController extends ChangeNotifier {
  ChartAnnotationController({
    required this.stockCode,
    required this.repository,
    required this.outbox,
    required this.idFactory,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final String stockCode;
  final ChartAnnotationRepository repository;
  final ChartAnnotationOutbox outbox;
  final String Function() idFactory;
  final DateTime Function() _clock;

  List<ChartAnnotation> annotations = [];
  bool _loaded = false;
  int _localWrites = 0;

  Future<void> load() async {
    if (_loaded) return;
    final writesAtStart = _localWrites;
    final restored = await repository.load(stockCode);
    if (_localWrites == writesAtStart) annotations = restored;
    _loaded = true;
    notifyListeners();
  }

  Future<void> create({
    required ChartAnnotationType type,
    required List<ChartPoint> points,
  }) async {
    _localWrites += 1;
    final annotation = ChartAnnotation(
      id: idFactory(),
      stockCode: stockCode,
      type: type,
      points: List.of(points),
      hidden: false,
      updatedAt: _clock(),
      revision: 1,
    );
    annotations = [...annotations, annotation];
    await _persist(annotation, AnnotationOperation.upsert);
  }

  Future<void> move(
    String id, {
    required int candleDelta,
    required double priceDelta,
  }) async {
    await _update(
      id,
      (annotation) => annotation.copyWith(
        points: annotation.points
            .map(
              (point) =>
                  point.move(candleDelta: candleDelta, priceDelta: priceDelta),
            )
            .toList(growable: false),
      ),
    );
  }

  Future<void> updatePoint(String id, int index, ChartPoint point) async {
    await _update(id, (annotation) {
      final points = List<ChartPoint>.of(annotation.points)..[index] = point;
      return annotation.copyWith(points: points);
    });
  }

  Future<void> setHidden(String id, bool hidden) async {
    await _update(id, (annotation) => annotation.copyWith(hidden: hidden));
  }

  Future<void> delete(String id) async {
    final index = annotations.indexWhere((item) => item.id == id);
    if (index < 0) return;
    final deleted = annotations[index].copyWith(
      revision: annotations[index].revision + 1,
      updatedAt: _clock(),
    );
    annotations = annotations.where((item) => item.id != id).toList();
    await _persist(deleted, AnnotationOperation.delete);
  }

  Future<void> _update(
    String id,
    ChartAnnotation Function(ChartAnnotation annotation) update,
  ) async {
    final index = annotations.indexWhere((item) => item.id == id);
    if (index < 0) return;
    final current = annotations[index];
    final next = update(
      current,
    ).copyWith(revision: current.revision + 1, updatedAt: _clock());
    annotations = List.of(annotations)..[index] = next;
    await _persist(next, AnnotationOperation.upsert);
  }

  Future<void> _persist(
    ChartAnnotation annotation,
    AnnotationOperation operation,
  ) async {
    if (annotation.revision > 1) _localWrites += 1;
    notifyListeners();
    await repository.save(stockCode, annotations);
    await outbox.add(
      PendingAnnotationMutation(
        idempotencyKey:
            'annotation:${annotation.id}:${annotation.revision}:${operation.name}',
        annotationId: annotation.id,
        stockCode: stockCode,
        operation: operation,
        revision: annotation.revision,
        updatedAt: annotation.updatedAt,
      ),
    );
  }
}
