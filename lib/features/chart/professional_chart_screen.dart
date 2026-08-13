import 'package:candlesticks/candlesticks.dart' as chart;
import 'package:flutter/material.dart';

import '../../domain/stockcal_domain.dart';
import 'chart_data.dart';

class ProfessionalChartScreen extends StatefulWidget {
  const ProfessionalChartScreen({
    super.key,
    required this.candles,
    this.adjustmentFactors = const [],
  });

  final List<Candle> candles;
  final List<AdjustmentFactor> adjustmentFactors;

  @override
  State<ProfessionalChartScreen> createState() =>
      _ProfessionalChartScreenState();
}

class _ProfessionalChartScreenState extends State<ProfessionalChartScreen> {
  final _controller = chart.CandlesticksController();
  ChartTimeframe _timeframe = ChartTimeframe.daily;
  AdjustmentMode _adjustment = AdjustmentMode.none;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final adjusted = ChartDataTransformer.adjust(
      widget.candles,
      _adjustment,
      widget.adjustmentFactors,
    );
    final candles = ChartDataTransformer.aggregate(adjusted, _timeframe);
    final rendered = CandlestickAdapter.newestFirst(candles);
    final colors = Theme.of(context).colorScheme;

    return Material(
      color: colors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ChartToolbar(
            timeframe: _timeframe,
            adjustment: _adjustment,
            onTimeframeChanged: (value) => setState(() => _timeframe = value),
            onAdjustmentChanged: (value) => setState(() => _adjustment = value),
            onZoomIn: _controller.zoomIn,
            onZoomOut: _controller.zoomOut,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                const _RegionLabel(label: '真实行情', color: Color(0xFF147D64)),
                Expanded(child: Divider(color: colors.outlineVariant)),
                const _RegionLabel(label: '预测区', color: Color(0xFFB57900)),
              ],
            ),
          ),
          Expanded(
            child: rendered.length < 2
                ? const Center(child: Text('至少需要两根 K 线'))
                : chart.Candlesticks(
                    candles: rendered,
                    controller: _controller,
                    style: chart.CandleSticksStyle.light(
                      chartBackgroundColor: colors.surface,
                      gridLineColor: colors.outlineVariant.withValues(
                        alpha: 0.5,
                      ),
                      axisTextColor: colors.onSurfaceVariant,
                      candleBullColor: const Color(0xFFC53A43),
                      candleBearColor: const Color(0xFF16856B),
                      volumeBullColor: const Color(0x66C53A43),
                      volumeBearColor: const Color(0x6616856B),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ChartToolbar extends StatelessWidget {
  const _ChartToolbar({
    required this.timeframe,
    required this.adjustment,
    required this.onTimeframeChanged,
    required this.onAdjustmentChanged,
    required this.onZoomIn,
    required this.onZoomOut,
  });

  final ChartTimeframe timeframe;
  final AdjustmentMode adjustment;
  final ValueChanged<ChartTimeframe> onTimeframeChanged;
  final ValueChanged<AdjustmentMode> onAdjustmentChanged;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          children: [
            SegmentedButton<ChartTimeframe>(
              segments: ChartTimeframe.values
                  .map(
                    (value) =>
                        ButtonSegment(value: value, label: Text(value.label)),
                  )
                  .toList(growable: false),
              selected: {timeframe},
              showSelectedIcon: false,
              onSelectionChanged: (values) => onTimeframeChanged(values.first),
            ),
            const SizedBox(width: 8),
            PopupMenuButton<AdjustmentMode>(
              tooltip: '复权方式',
              initialValue: adjustment,
              onSelected: onAdjustmentChanged,
              itemBuilder: (context) => AdjustmentMode.values
                  .map(
                    (value) =>
                        PopupMenuItem(value: value, child: Text(value.label)),
                  )
                  .toList(growable: false),
              child: SizedBox(
                height: 48,
                child: Row(
                  children: [
                    const Icon(Icons.tune, size: 20),
                    const SizedBox(width: 6),
                    Text(adjustment.label),
                    const Icon(Icons.arrow_drop_down),
                  ],
                ),
              ),
            ),
            IconButton(
              tooltip: '放大 K 线',
              onPressed: onZoomIn,
              icon: const Icon(Icons.zoom_in),
            ),
            IconButton(
              tooltip: '缩小 K 线',
              onPressed: onZoomOut,
              icon: const Icon(Icons.zoom_out),
            ),
          ],
        ),
      ),
    );
  }
}

class _RegionLabel extends StatelessWidget {
  const _RegionLabel({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 8, height: 8, color: color),
          const SizedBox(width: 6),
          Text(label, style: Theme.of(context).textTheme.labelMedium),
        ],
      ),
    );
  }
}

extension on ChartTimeframe {
  String get label => switch (this) {
    ChartTimeframe.daily => '日线',
    ChartTimeframe.weekly => '周线',
    ChartTimeframe.monthly => '月线',
  };
}

extension on AdjustmentMode {
  String get label => switch (this) {
    AdjustmentMode.none => '不复权',
    AdjustmentMode.forward => '前复权',
    AdjustmentMode.backward => '后复权',
  };
}
