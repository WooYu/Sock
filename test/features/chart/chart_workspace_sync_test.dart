import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/chart/chart_annotations.dart';

void main() {
  test('serializes annotation points for remote sync', () {
    final annotation = ChartAnnotation(
      id: 'remote-1',
      stockCode: '600519',
      type: ChartAnnotationType.trendLine,
      points: const [ChartPoint(candleIndex: 1, price: 10)],
      hidden: false,
      updatedAt: DateTime.parse('2026-09-01T10:00:00Z'),
      revision: 2,
    );

    final payload = chartAnnotationToJson(annotation);

    expect(payload['type'], 'trendLine');
    expect((payload['points']! as List<Object?>).single, containsPair('price', 10));
  });
}
