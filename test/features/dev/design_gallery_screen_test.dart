import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/dev/design_gallery_screen.dart';
import 'package:stockcal/theme/stockcal_theme.dart';
import 'package:stockcal/widgets/design.dart';

void main() {
  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets('画廊在 $brightness 下渲染全部组件且不溢出', (tester) async {
      tester.view.physicalSize = const Size(1400, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        MaterialApp(
          theme: buildStockCalTheme(brightness),
          home: const DesignGalleryScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(SectionHeading), findsWidgets);
      expect(find.byType(PanelCard), findsWidgets);
      expect(find.byType(MetricStrip), findsWidgets);
      expect(find.byType(LedgerTable), findsWidgets);
      expect(find.byType(SegTabs), findsWidgets);
      expect(find.byType(ScoreBar), findsWidgets);
      expect(find.byType(StatusBadge), findsWidgets);
      expect(find.byType(SwitchPill), findsWidgets);
      expect(find.byType(AppButton), findsWidgets);
      expect(find.byType(MonoText), findsWidgets);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('画廊里的开关与分段可交互', (tester) async {
    tester.view.physicalSize = const Size(1400, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildStockCalTheme(Brightness.light),
        home: const DesignGalleryScreen(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(SwitchPill).first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
