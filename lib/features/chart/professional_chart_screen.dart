import 'package:candlesticks/candlesticks.dart' as chart;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../domain/stockcal_domain.dart';
import '../analysis/technical_analysis.dart';
import 'chart_annotations.dart';
import 'chart_data.dart';
import '../../theme/stockcal_theme.dart';

class ProfessionalChartScreen extends StatefulWidget {
  const ProfessionalChartScreen({
    super.key,
    required this.candles,
    this.stockCode = '600519',
    this.annotationController,
    this.adjustmentFactors = const [],
  });

  final List<Candle> candles;
  final String stockCode;
  final ChartAnnotationController? annotationController;
  final List<AdjustmentFactor> adjustmentFactors;

  @override
  State<ProfessionalChartScreen> createState() =>
      _ProfessionalChartScreenState();
}

class _ProfessionalChartScreenState extends State<ProfessionalChartScreen> {
  final _controller = chart.CandlesticksController();
  late final ChartAnnotationController _annotations;
  late final bool _ownsAnnotations;
  ChartTimeframe _timeframe = ChartTimeframe.daily;
  AdjustmentMode _adjustment = AdjustmentMode.none;
  final Set<_IndicatorLayer> _indicatorLayers = {..._IndicatorLayer.values};
  String? _selectedAnnotationId;

  @override
  void initState() {
    super.initState();
    _ownsAnnotations = widget.annotationController == null;
    _annotations =
        widget.annotationController ??
        ChartAnnotationController(
          stockCode: widget.stockCode,
          repository: MemoryChartAnnotationRepository(),
          outbox: MemoryChartAnnotationOutbox(),
          idFactory: () =>
              'annotation-${DateTime.now().microsecondsSinceEpoch}',
        );
    _annotations.addListener(_onAnnotationsChanged);
    _annotations.load();
  }

  void _onAnnotationsChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _annotations.removeListener(_onAnnotationsChanged);
    if (_ownsAnnotations) _annotations.dispose();
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
    final size = MediaQuery.sizeOf(context);
    final landscapeCompact = size.height < 500 && size.width > size.height;
    final wide = size.width >= 760 && !landscapeCompact;

    return Material(
      color: colors.surface,
      child: Row(
        key: landscapeCompact ? const Key('landscape-chart-workspace') : null,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ChartToolbar(
                  timeframe: _timeframe,
                  adjustment: _adjustment,
                  showDrawingTools: wide,
                  onTimeframeChanged: (value) =>
                      setState(() => _timeframe = value),
                  onAdjustmentChanged: (value) =>
                      setState(() => _adjustment = value),
                  onZoomIn: _controller.zoomIn,
                  onZoomOut: _controller.zoomOut,
                  onCreateAnnotation: _createAnnotation,
                  onOpenTools: () => _openDrawingTools(context),
                ),
                _IndicatorToolbar(
                  selected: _indicatorLayers,
                  onChanged: (layer, enabled) {
                    setState(() {
                      enabled
                          ? _indicatorLayers.add(layer)
                          : _indicatorLayers.remove(layer);
                    });
                  },
                ),
                if (!landscapeCompact)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                    child: Row(
                      children: [
                        const _RegionLabel(
                          label: '真实行情',
                          color: StockCalColors.loss,
                        ),
                        Expanded(child: Divider(color: colors.outlineVariant)),
                        const _RegionLabel(
                          label: '预测区',
                          color: StockCalColors.accent,
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: rendered.length < 2
                      ? const Center(child: Text('至少需要两根 K 线'))
                      : Stack(
                          fit: StackFit.expand,
                          children: [
                            chart.Candlesticks(
                              candles: rendered,
                              controller: _controller,
                              style: chart.CandleSticksStyle.light(
                                chartBackgroundColor: colors.surface,
                                gridLineColor: colors.outlineVariant.withValues(
                                  alpha: 0.5,
                                ),
                                axisTextColor: colors.onSurfaceVariant,
                                candleBullColor: StockCalColors.gain,
                                candleBearColor: StockCalColors.loss,
                                volumeBullColor: StockCalColors.gain.withValues(
                                  alpha: 0.4,
                                ),
                                volumeBearColor: StockCalColors.loss.withValues(
                                  alpha: 0.4,
                                ),
                              ),
                            ),
                            IgnorePointer(
                              child: CustomPaint(
                                key: const Key('indicator-canvas'),
                                painter: _IndicatorPainter(
                                  candles: candles,
                                  layers: _indicatorLayers,
                                ),
                              ),
                            ),
                            IgnorePointer(
                              child: CustomPaint(
                                key: const Key('annotation-canvas'),
                                painter: _AnnotationPainter(
                                  annotations: _annotations.annotations,
                                  candles: candles,
                                ),
                              ),
                            ),
                            if (_selectedAnnotationId != null)
                              LayoutBuilder(
                                builder: (context, constraints) =>
                                    GestureDetector(
                                      key: const Key(
                                        'annotation-gesture-layer',
                                      ),
                                      behavior: HitTestBehavior.opaque,
                                      onPanEnd: (_) => setState(
                                        () => _selectedAnnotationId = null,
                                      ),
                                      onPanUpdate: (details) => _moveSelected(
                                        details.delta,
                                        constraints.biggest,
                                        candles,
                                      ),
                                      child: const Align(
                                        alignment: Alignment.topCenter,
                                        child: Padding(
                                          padding: EdgeInsets.all(8),
                                          child: Text('拖动编辑中'),
                                        ),
                                      ),
                                    ),
                              ),
                          ],
                        ),
                ),
              ],
            ),
          ),
          if (wide)
            SizedBox(
              width: 280,
              child: _AnnotationManager(
                controller: _annotations,
                selectedId: _selectedAnnotationId,
                onSelected: (id) => setState(
                  () => _selectedAnnotationId = _selectedAnnotationId == id
                      ? null
                      : id,
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _moveSelected(Offset delta, Size size, List<Candle> candles) {
    final id = _selectedAnnotationId;
    if (id == null || candles.isEmpty || size.isEmpty) return;
    final high = candles
        .map((item) => item.high)
        .reduce((a, b) => a > b ? a : b);
    final low = candles.map((item) => item.low).reduce((a, b) => a < b ? a : b);
    final candleDelta = (delta.dx / size.width * candles.length).round();
    final priceDelta = -delta.dy / (size.height * 0.8) * (high - low);
    if (candleDelta != 0 || priceDelta != 0) {
      _annotations.move(id, candleDelta: candleDelta, priceDelta: priceDelta);
    }
  }

  Future<void> _createAnnotation(ChartAnnotationType type) async {
    final lastIndex = widget.candles.length - 1;
    final lastPrice = widget.candles.last.close;
    final points = switch (type) {
      ChartAnnotationType.trendLine || ChartAnnotationType.rectangle => [
        ChartPoint(
          candleIndex: (lastIndex - 8).clamp(0, lastIndex),
          price: lastPrice * 0.97,
        ),
        ChartPoint(candleIndex: lastIndex, price: lastPrice * 1.03),
      ],
      ChartAnnotationType.horizontalLine || ChartAnnotationType.point => [
        ChartPoint(candleIndex: lastIndex, price: lastPrice),
      ],
    };
    await _annotations.create(type: type, points: points);
  }

  Future<void> _openDrawingTools(BuildContext context) async {
    final selected = await showModalBottomSheet<ChartAnnotationType>(
      context: context,
      showDragHandle: true,
      builder: (context) => const _DrawingToolSheet(),
    );
    if (selected != null) await _createAnnotation(selected);
  }
}

class _ChartToolbar extends StatelessWidget {
  const _ChartToolbar({
    required this.timeframe,
    required this.adjustment,
    required this.showDrawingTools,
    required this.onTimeframeChanged,
    required this.onAdjustmentChanged,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onCreateAnnotation,
    required this.onOpenTools,
  });

  final ChartTimeframe timeframe;
  final AdjustmentMode adjustment;
  final bool showDrawingTools;
  final ValueChanged<ChartTimeframe> onTimeframeChanged;
  final ValueChanged<AdjustmentMode> onAdjustmentChanged;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final ValueChanged<ChartAnnotationType> onCreateAnnotation;
  final VoidCallback onOpenTools;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(8, 6, 0, 6),
              child: Row(
                children: [
                  SegmentedButton<ChartTimeframe>(
                    segments: ChartTimeframe.values
                        .map(
                          (value) => ButtonSegment(
                            value: value,
                            label: Text(value.label),
                          ),
                        )
                        .toList(growable: false),
                    selected: {timeframe},
                    showSelectedIcon: false,
                    onSelectionChanged: (values) =>
                        onTimeframeChanged(values.first),
                  ),
                  const SizedBox(width: 8),
                  PopupMenuButton<AdjustmentMode>(
                    tooltip: '复权方式',
                    initialValue: adjustment,
                    onSelected: onAdjustmentChanged,
                    itemBuilder: (context) => AdjustmentMode.values
                        .map(
                          (value) => PopupMenuItem(
                            value: value,
                            child: Text(value.label),
                          ),
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
                  if (showDrawingTools)
                    for (final type in ChartAnnotationType.values)
                      IconButton(
                        tooltip: type.label,
                        onPressed: () => onCreateAnnotation(type),
                        icon: Icon(type.icon),
                      ),
                ],
              ),
            ),
          ),
          if (!showDrawingTools) ...[
            const VerticalDivider(width: 1),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: IconButton(
                tooltip: '绘图工具',
                onPressed: onOpenTools,
                icon: const Icon(Icons.draw_outlined),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

enum _IndicatorLayer { ma5, ma20, ema12, boll }

extension on _IndicatorLayer {
  String get label => switch (this) {
    _IndicatorLayer.ma5 => 'MA5',
    _IndicatorLayer.ma20 => 'MA20',
    _IndicatorLayer.ema12 => 'EMA12',
    _IndicatorLayer.boll => 'BOLL',
  };
}

class _IndicatorToolbar extends StatelessWidget {
  const _IndicatorToolbar({required this.selected, required this.onChanged});

  final Set<_IndicatorLayer> selected;
  final void Function(_IndicatorLayer layer, bool enabled) onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        itemCount: _IndicatorLayer.values.length,
        separatorBuilder: (_, _) => const SizedBox(width: 6),
        itemBuilder: (context, index) {
          final layer = _IndicatorLayer.values[index];
          return FilterChip(
            label: Text(layer.label),
            selected: selected.contains(layer),
            showCheckmark: false,
            onSelected: (enabled) => onChanged(layer, enabled),
          );
        },
      ),
    );
  }
}

class _IndicatorPainter extends CustomPainter {
  _IndicatorPainter({required this.candles, required this.layers});

  final List<Candle> candles;
  final Set<_IndicatorLayer> layers;

  @override
  void paint(Canvas canvas, Size size) {
    if (candles.length < 20 || layers.isEmpty) return;
    final calculator = IndicatorCalculator();
    final high = candles
        .map((item) => item.high)
        .reduce((a, b) => a > b ? a : b);
    final low = candles.map((item) => item.low).reduce((a, b) => a < b ? a : b);
    final range = high - low == 0 ? 1.0 : high - low;
    final plotHeight = size.height * 0.8;

    void drawSeries(List<double?> values, Color color) {
      final path = Path();
      var started = false;
      for (var index = 0; index < values.length; index++) {
        final value = values[index];
        if (value == null) continue;
        final x = size.width * index / (values.length - 1);
        final y = plotHeight * (high - value) / range;
        if (started) {
          path.lineTo(x, y);
        } else {
          path.moveTo(x, y);
          started = true;
        }
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..strokeWidth = 1.4
          ..style = PaintingStyle.stroke,
      );
    }

    if (layers.contains(_IndicatorLayer.ma5)) {
      drawSeries(calculator.sma(candles, period: 5), StockCalColors.accent);
    }
    if (layers.contains(_IndicatorLayer.ma20)) {
      drawSeries(calculator.sma(candles, period: 20), StockCalColors.primary);
    }
    if (layers.contains(_IndicatorLayer.ema12)) {
      drawSeries(calculator.ema(candles, period: 12), StockCalColors.textSecondary);
    }
    if (layers.contains(_IndicatorLayer.boll)) {
      final bands = calculator.bollinger(candles, period: 20);
      drawSeries(
        bands.map((item) => item?.upper).toList(),
        StockCalColors.border,
      );
      drawSeries(
        bands.map((item) => item?.middle).toList(),
        StockCalColors.textPrimary,
      );
      drawSeries(
        bands.map((item) => item?.lower).toList(),
        StockCalColors.border,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _IndicatorPainter oldDelegate) =>
      oldDelegate.candles != candles || !setEquals(oldDelegate.layers, layers);
}

class _AnnotationManager extends StatelessWidget {
  const _AnnotationManager({
    required this.controller,
    required this.selectedId,
    required this.onSelected,
  });

  final ChartAnnotationController controller;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text('标注管理', style: Theme.of(context).textTheme.titleSmall),
          ),
          const Divider(height: 1),
          Expanded(
            child: controller.annotations.isEmpty
                ? const Center(child: Text('暂无标注'))
                : ListView.builder(
                    itemCount: controller.annotations.length,
                    itemBuilder: (context, index) {
                      final annotation = controller.annotations[index];
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            InkWell(
                              onTap: () => onSelected(annotation.id),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 8,
                                ),
                                child: Row(
                                  children: [
                                    Icon(annotation.type.icon, size: 20),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        '${annotation.type.label} ${index + 1}',
                                      ),
                                    ),
                                    if (selectedId == annotation.id)
                                      const Icon(Icons.open_with, size: 18),
                                  ],
                                ),
                              ),
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                IconButton(
                                  tooltip: '向右移动',
                                  onPressed: () => controller.move(
                                    annotation.id,
                                    candleDelta: 1,
                                    priceDelta: 0,
                                  ),
                                  icon: const Icon(Icons.arrow_forward),
                                ),
                                IconButton(
                                  tooltip: '编辑控制点',
                                  onPressed: () => _editAnnotation(
                                    context,
                                    controller,
                                    annotation,
                                  ),
                                  icon: const Icon(Icons.edit_outlined),
                                ),
                                IconButton(
                                  tooltip: annotation.hidden ? '显示标注' : '隐藏标注',
                                  onPressed: () => controller.setHidden(
                                    annotation.id,
                                    !annotation.hidden,
                                  ),
                                  icon: Icon(
                                    annotation.hidden
                                        ? Icons.visibility_off_outlined
                                        : Icons.visibility_outlined,
                                  ),
                                ),
                                IconButton(
                                  tooltip: '删除标注',
                                  onPressed: () =>
                                      controller.delete(annotation.id),
                                  icon: const Icon(Icons.delete_outline),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text('待同步 ${controller.annotations.length}'),
          ),
        ],
      ),
    );
  }

  Future<void> _editAnnotation(
    BuildContext context,
    ChartAnnotationController controller,
    ChartAnnotation annotation,
  ) async {
    final point = annotation.points.first;
    var candleText = point.candleIndex.toString();
    var priceText = point.price.toString();
    final result = await showDialog<ChartPoint>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('编辑标注'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                initialValue: candleText,
                onChanged: (value) => candleText = value,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'K 线序号'),
              ),
              TextFormField(
                initialValue: priceText,
                onChanged: (value) => priceText = value,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(labelText: '价格'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              final candleIndex = int.tryParse(candleText);
              final price = double.tryParse(priceText);
              if (candleIndex != null && price != null) {
                Navigator.pop(
                  context,
                  ChartPoint(candleIndex: candleIndex, price: price),
                );
              }
            },
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (result != null) {
      await controller.updatePoint(annotation.id, 0, result);
    }
  }
}

class _DrawingToolSheet extends StatelessWidget {
  const _DrawingToolSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('绘图与标注', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final type in ChartAnnotationType.values)
              ListTile(
                leading: Icon(type.icon),
                title: Text(type.label),
                onTap: () => Navigator.pop(context, type),
              ),
          ],
        ),
      ),
    );
  }
}

class _AnnotationPainter extends CustomPainter {
  _AnnotationPainter({required this.annotations, required this.candles});

  final List<ChartAnnotation> annotations;
  final List<Candle> candles;

  @override
  void paint(Canvas canvas, Size size) {
    if (candles.isEmpty) return;
    final high = candles
        .map((item) => item.high)
        .reduce((a, b) => a > b ? a : b);
    final low = candles.map((item) => item.low).reduce((a, b) => a < b ? a : b);
    final range = high - low == 0 ? 1.0 : high - low;
    final paint = Paint()
      ..color = StockCalColors.accent
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    Offset offset(ChartPoint point) => Offset(
      size.width *
          point.candleIndex /
          (candles.length - 1).clamp(1, candles.length),
      size.height * 0.8 * (high - point.price) / range,
    );
    for (final annotation in annotations.where((item) => !item.hidden)) {
      final points = annotation.points.map(offset).toList();
      switch (annotation.type) {
        case ChartAnnotationType.trendLine:
          canvas.drawLine(points.first, points.last, paint);
        case ChartAnnotationType.horizontalLine:
          canvas.drawLine(
            Offset.zero.translate(0, points.first.dy),
            Offset(size.width, points.first.dy),
            paint,
          );
        case ChartAnnotationType.rectangle:
          canvas.drawRect(Rect.fromPoints(points.first, points.last), paint);
        case ChartAnnotationType.point:
          canvas.drawCircle(points.first, 5, paint..style = PaintingStyle.fill);
          paint.style = PaintingStyle.stroke;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _AnnotationPainter oldDelegate) =>
      oldDelegate.annotations != annotations || oldDelegate.candles != candles;
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

extension on ChartAnnotationType {
  String get label => switch (this) {
    ChartAnnotationType.trendLine => '趋势线',
    ChartAnnotationType.horizontalLine => '水平线',
    ChartAnnotationType.rectangle => '矩形',
    ChartAnnotationType.point => '点位',
  };

  IconData get icon => switch (this) {
    ChartAnnotationType.trendLine => Icons.show_chart,
    ChartAnnotationType.horizontalLine => Icons.horizontal_rule,
    ChartAnnotationType.rectangle => Icons.crop_square,
    ChartAnnotationType.point => Icons.place_outlined,
  };
}
