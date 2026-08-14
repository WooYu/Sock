import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/chart/chart_annotations.dart';
import 'package:stockcal/features/chart/persistent_chart_annotation_store.dart';

void main() {
  test('annotations and pending mutations survive store recreation', () async {
    SharedPreferences.setMockInitialValues({});
    final time = DateTime.utc(2026, 8, 14);
    final first = PersistentChartAnnotationStore();
    await first.save('600519', [
      ChartAnnotation(
        id: 'a1',
        stockCode: '600519',
        type: ChartAnnotationType.point,
        points: const [ChartPoint(candleIndex: 2, price: 1700)],
        hidden: false,
        updatedAt: time,
        revision: 1,
      ),
    ]);
    await first.add(
      PendingAnnotationMutation(
        idempotencyKey: 'a1:1',
        annotationId: 'a1',
        stockCode: '600519',
        operation: AnnotationOperation.upsert,
        revision: 1,
        updatedAt: time,
      ),
    );

    final restored = PersistentChartAnnotationStore();
    expect((await restored.load('600519')).single.id, 'a1');
    expect((await restored.loadPending()).single.idempotencyKey, 'a1:1');
  });
}
