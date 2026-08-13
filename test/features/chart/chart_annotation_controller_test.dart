import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/chart/chart_annotations.dart';

void main() {
  group('ChartAnnotationController', () {
    late MemoryChartAnnotationRepository repository;
    late MemoryChartAnnotationOutbox outbox;
    late ChartAnnotationController controller;

    setUp(() {
      repository = MemoryChartAnnotationRepository();
      outbox = MemoryChartAnnotationOutbox();
      controller = ChartAnnotationController(
        stockCode: '600519',
        repository: repository,
        outbox: outbox,
        idFactory: _Ids(['a1', 'a2']).next,
        clock: () => DateTime(2026, 8, 14, 10),
      );
    });

    test('creates each supported annotation locally and queues sync', () async {
      await controller.create(
        type: ChartAnnotationType.trendLine,
        points: const [
          ChartPoint(candleIndex: 2, price: 10),
          ChartPoint(candleIndex: 8, price: 15),
        ],
      );
      await controller.create(
        type: ChartAnnotationType.rectangle,
        points: const [
          ChartPoint(candleIndex: 4, price: 11),
          ChartPoint(candleIndex: 9, price: 14),
        ],
      );

      expect(controller.annotations, hasLength(2));
      expect((await repository.load('600519')), hasLength(2));
      expect(outbox.pending.map((item) => item.operation), [
        AnnotationOperation.upsert,
        AnnotationOperation.upsert,
      ]);
    });

    test('moves, edits control points, and hides an annotation', () async {
      await controller.create(
        type: ChartAnnotationType.horizontalLine,
        points: const [ChartPoint(candleIndex: 3, price: 12)],
      );

      await controller.move('a1', candleDelta: 2, priceDelta: 1.5);
      await controller.updatePoint(
        'a1',
        0,
        const ChartPoint(candleIndex: 7, price: 18),
      );
      await controller.setHidden('a1', true);

      final annotation = controller.annotations.single;
      expect(annotation.points.single.candleIndex, 7);
      expect(annotation.points.single.price, 18);
      expect(annotation.hidden, isTrue);
      expect(outbox.pending, hasLength(4));
    });

    test('deletes locally and queues an immutable tombstone', () async {
      await controller.create(
        type: ChartAnnotationType.point,
        points: const [ChartPoint(candleIndex: 1, price: 9)],
      );

      await controller.delete('a1');

      expect(controller.annotations, isEmpty);
      expect((await repository.load('600519')), isEmpty);
      expect(outbox.pending.last.operation, AnnotationOperation.delete);
      expect(outbox.pending.last.annotationId, 'a1');
    });

    test('loads only annotations belonging to the active stock', () async {
      await repository.save('000001', [_annotation('other', '000001')]);
      await repository.save('600519', [_annotation('mine', '600519')]);

      await controller.load();

      expect(controller.annotations.single.id, 'mine');
    });
  });
}

ChartAnnotation _annotation(String id, String code) => ChartAnnotation(
  id: id,
  stockCode: code,
  type: ChartAnnotationType.point,
  points: const [ChartPoint(candleIndex: 1, price: 10)],
  hidden: false,
  updatedAt: DateTime(2026, 8, 14),
  revision: 1,
);

class _Ids {
  _Ids(this.values);

  final List<String> values;
  int index = 0;

  String next() => values[index++];
}
