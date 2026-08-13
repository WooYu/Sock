import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/app/stockcal_app.dart';

void main() {
  testWidgets('home screen presents the phase one calculation shell', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());

    expect(find.text('StockCal'), findsOneWidget);
    expect(find.text('Trade Calendar'), findsOneWidget);
    expect(find.text('Position Calculator'), findsOneWidget);
    expect(find.text('Risk Dashboard'), findsOneWidget);
  });
}
