import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';
import '../../widgets/design.dart';

/// 组件画廊。仅供开发期对照原型核对还原度，不进主导航。
class DesignGalleryScreen extends StatefulWidget {
  const DesignGalleryScreen({super.key});

  @override
  State<DesignGalleryScreen> createState() => _DesignGalleryScreenState();
}

class _DesignGalleryScreenState extends State<DesignGalleryScreen> {
  int _cycle = 0;
  int _period = 0;
  int _side = 0;
  bool _switchA = true;
  bool _switchB = false;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('组件画廊')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '指标条',
            trailing: StatusBadge('MetricStrip'),
          ),
          const MetricStrip(cells: [
            MetricCell(label: '持仓股票', value: '3', unit: '只'),
            MetricCell(label: '总投入', value: '78570.00', unit: '元'),
            MetricCell(label: '当前市值', value: '79916.00', unit: '元'),
            MetricCell(
              label: '总浮动盈亏',
              value: '+1346.00',
              unit: '元',
              tone: MetricTone.profit,
            ),
            MetricCell(label: '已实现盈亏', value: '+84.00', unit: '元'),
            MetricCell(
              label: '组合收益率',
              value: '+1.82%',
              unit: '浮动 + 已实现',
              tone: MetricTone.profit,
            ),
          ]),
          const SizedBox(height: 12),
          Text(
            '窄约束（塌为 2 列，末格跨满）',
            style: TextStyle(fontSize: StockCalType.eyebrow, color: t.faint),
          ),
          const SizedBox(height: 6),
          SizedBox(
            width: 380,
            child: const MetricStrip(
              columns: 5,
              cells: [
                MetricCell(label: '累计盈亏', value: '+552.00', unit: '元'),
                MetricCell(label: '盈利天数', value: '4 / 5', unit: '交易日'),
                MetricCell(label: '交易次数', value: '12', unit: '买卖合计'),
                MetricCell(label: '平均单笔', value: '46.00', unit: '元'),
                MetricCell(
                  label: '执行偏差',
                  value: '16.7%',
                  unit: '未按计划',
                  tone: MetricTone.risk,
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '账本表格',
            trailing: StatusBadge('LedgerTable'),
          ),
          LedgerTable(
            columns: const [
              LedgerColumn('股票', 12),
              LedgerColumn('持仓/成本', 10),
              LedgerColumn('浮动盈亏', 9),
              LedgerColumn('', 9),
            ],
            rows: [
              LedgerRow(
                onTap: () {},
                cells: [
                  const Text('华芯动力'),
                  const MonoText('1500 股'),
                  MonoText('+1170.00', color: t.profit),
                  Text(
                    '查看详情 →',
                    style: TextStyle(
                      fontSize: StockCalType.eyebrow,
                      color: t.accent,
                    ),
                  ),
                ],
              ),
              LedgerRow(
                onTap: () {},
                cells: [
                  const Text('新能材料'),
                  const MonoText('600 股'),
                  MonoText('-288.00', color: t.loss),
                  Text(
                    '查看详情 →',
                    style: TextStyle(
                      fontSize: StockCalType.eyebrow,
                      color: t.accent,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '分段切换',
            trailing: StatusBadge('SegTabs'),
          ),
          PanelCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'pill · 操作周期',
                  style: TextStyle(
                    fontSize: StockCalType.eyebrow,
                    color: t.faint,
                  ),
                ),
                const SizedBox(height: 6),
                SegTabs(
                  labels: const ['短线', '波段', '中长线'],
                  selected: _cycle,
                  onSelected: (i) => setState(() => _cycle = i),
                ),
                const SizedBox(height: 16),
                Text(
                  'chip · K线周期',
                  style: TextStyle(
                    fontSize: StockCalType.eyebrow,
                    color: t.faint,
                  ),
                ),
                const SizedBox(height: 6),
                SegTabs(
                  labels: const ['日线', '周线', '月线'],
                  selected: _period,
                  variant: SegTabsVariant.chip,
                  onSelected: (i) => setState(() => _period = i),
                ),
                const SizedBox(height: 16),
                Text(
                  'duo · 交易方向',
                  style: TextStyle(
                    fontSize: StockCalType.eyebrow,
                    color: t.faint,
                  ),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  width: 260,
                  child: SegTabs(
                    labels: const ['买入', '卖出'],
                    selected: _side,
                    variant: SegTabsVariant.duo,
                    onSelected: (i) => setState(() => _side = i),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '打分条与强度仪表',
            trailing: StatusBadge('ScoreBar'),
          ),
          PanelCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (label, v, tone) in [
                  ('主策略', 86.0, ScoreTone.accent),
                  ('备选', 74.0, ScoreTone.accent),
                  ('风控', 61.0, ScoreTone.amber),
                  ('警戒', 39.0, ScoreTone.fall),
                ]) ...[
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: StockCalType.eyebrow,
                      color: t.faint,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ScoreBar(value: v, tone: tone),
                  const SizedBox(height: 12),
                ],
                const SizedBox(height: 4),
                Text(
                  'gauge · 方向强度 64/100',
                  style: TextStyle(
                    fontSize: StockCalType.eyebrow,
                    color: t.faint,
                  ),
                ),
                const SizedBox(height: 8),
                const ScoreBar(value: 64, variant: ScoreBarVariant.gauge),
              ],
            ),
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '徽章',
            trailing: StatusBadge('StatusBadge'),
          ),
          const Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusBadge('演示数据'),
              StatusBadge('DEMO', tone: BadgeTone.amber),
              StatusBadge('R-07', tone: BadgeTone.amber, mono: true),
              StatusBadge('上涨关键区', tone: BadgeTone.rise),
              StatusBadge('下跌支撑区', tone: BadgeTone.fall),
              StatusBadge('买入', tone: BadgeTone.profit),
              StatusBadge('卖出', tone: BadgeTone.loss),
              StatusBadge('一致', tone: BadgeTone.fall, dot: true),
              StatusBadge('待复盘', tone: BadgeTone.accent),
            ],
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '开关与按钮',
            trailing: StatusBadge('SwitchPill / AppButton'),
          ),
          PanelCard(
            child: Row(
              children: [
                SwitchPill(
                  value: _switchA,
                  semanticLabel: '停用规则 R-07',
                  onChanged: (v) => setState(() => _switchA = v),
                ),
                const SizedBox(width: 16),
                SwitchPill(
                  value: _switchB,
                  semanticLabel: '停用规则 R-03',
                  onChanged: (v) => setState(() => _switchB = v),
                ),
                const SizedBox(width: 24),
                AppButton(label: '保存交易记录', onPressed: () {}),
                const SizedBox(width: 8),
                AppButton(
                  label: '恢复全部调整',
                  variant: AppButtonVariant.ghost,
                  onPressed: () {},
                ),
                const SizedBox(width: 8),
                const AppButton(label: '已停用'),
              ],
            ),
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '等宽数字',
            trailing: StatusBadge('MonoText'),
          ),
          PanelCard(
            child: Row(
              children: [
                const MonoText('32.68', size: StockCalType.metricLg),
                const SizedBox(width: 16),
                MonoText('+0.86', color: t.rise),
                const SizedBox(width: 16),
                MonoText('-288.00', color: t.loss),
                const SizedBox(width: 16),
                MonoText('11111.11', color: t.muted),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
