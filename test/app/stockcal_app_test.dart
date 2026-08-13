import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('StockCal app uses production title and Material 3 theme', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));

    expect(app.title, 'StockCal');
    expect(app.debugShowCheckedModeBanner, isFalse);
    expect(app.theme?.useMaterial3, isTrue);
    expect(app.theme?.colorScheme.brightness, Brightness.light);
  });
}
