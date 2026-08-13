import 'package:flutter/material.dart';

import '../../domain/stockcal_domain.dart';
import '../../domain/stockcal_services.dart';
import '../analysis/stock_analysis_controller.dart';
import '../analysis/stock_analysis_screen.dart';
import '../analysis/technical_analysis.dart';
import '../market/market_data.dart';
import '../portfolio/portfolio_controller.dart';
import '../portfolio/portfolio_ledger.dart';
import '../portfolio/portfolio_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  var _selected = '总览';
  late final PortfolioController _portfolioController;
  late final StockAnalysisController _stockAnalysisController;

  static const _modules = [
    '总览',
    '个股分析',
    '专业K线',
    '规则回测',
    '组合交易',
    '复盘AI',
    '设置后台',
  ];

  @override
  void initState() {
    super.initState();
    _portfolioController = PortfolioController(
      ledger: PortfolioLedger(openingCash: 500000),
      marketPrices: const {'600519': 1742, '000001': 14, '300750': 102},
    );
    _stockAnalysisController = StockAnalysisController(
      catalog: const MemoryStockCatalog(DemoAshareData.securities),
      market: DemoAshareMarketAdapter(),
      analyzer: StockAnalyzer(),
    );
  }

  @override
  void dispose() {
    _portfolioController.dispose();
    _stockAnalysisController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 600;
    final mobileIndex = switch (_selected) {
      '总览' => 0,
      '个股分析' => 1,
      '专业K线' => 2,
      '组合交易' => 3,
      _ => 4,
    };

    return Scaffold(
      appBar: AppBar(title: const Text('StockCal')),
      body: Row(
        children: [
          if (wide)
            NavigationRail(
              selectedIndex: _modules.indexOf(_selected),
              onDestinationSelected: (index) {
                setState(() => _selected = _modules[index]);
              },
              labelType: NavigationRailLabelType.all,
              destinations: const [
                NavigationRailDestination(
                  icon: Icon(Icons.dashboard_outlined),
                  selectedIcon: Icon(Icons.dashboard),
                  label: Text('总览'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.search),
                  label: Text('个股分析'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.candlestick_chart_outlined),
                  label: Text('专业K线'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.rule),
                  label: Text('规则回测'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.account_balance_wallet_outlined),
                  label: Text('组合交易'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.rate_review_outlined),
                  label: Text('复盘AI'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.settings_outlined),
                  label: Text('设置后台'),
                ),
              ],
            ),
          Expanded(
            child: _Workspace(
              module: _selected,
              portfolioController: _portfolioController,
              stockAnalysisController: _stockAnalysisController,
              onNavigate: (module) => setState(() => _selected = module),
            ),
          ),
        ],
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: mobileIndex,
              onDestinationSelected: (index) {
                const destinations = ['总览', '个股分析', '专业K线', '组合交易', '更多'];
                setState(() => _selected = destinations[index]);
              },
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.dashboard_outlined),
                  label: '总览',
                ),
                NavigationDestination(icon: Icon(Icons.search), label: '个股分析'),
                NavigationDestination(
                  icon: Icon(Icons.candlestick_chart_outlined),
                  label: '专业K线',
                ),
                NavigationDestination(
                  icon: Icon(Icons.account_balance_wallet_outlined),
                  label: '组合',
                ),
                NavigationDestination(
                  icon: Icon(Icons.more_horiz),
                  label: '更多',
                ),
              ],
            ),
    );
  }
}

class _Workspace extends StatelessWidget {
  const _Workspace({
    required this.module,
    required this.portfolioController,
    required this.stockAnalysisController,
    required this.onNavigate,
  });

  final String module;
  final PortfolioController portfolioController;
  final StockAnalysisController stockAnalysisController;
  final ValueChanged<String> onNavigate;

  @override
  Widget build(BuildContext context) {
    if (module == '组合交易') {
      return PortfolioScreen(controller: portfolioController);
    }
    if (module == '个股分析') {
      return StockAnalysisScreen(controller: stockAnalysisController);
    }
    final portfolio = DemoMarketData.portfolio;
    final prediction = PredictionEngine().predict(
      DemoMarketData.candlesFor('600519'),
    );
    final quote = DemoMarketAdapter().quote('600519');
    final review = ReviewAssistant().summarize(
      symbol: '600519',
      support: prediction.support,
      resistance: prediction.resistance,
      actualClose: quote.price,
    );

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(module, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        if (module == '总览') ...[
          Text('总资产 ${portfolio.marketValue.toStringAsFixed(0)}'),
          Text('累计盈亏 ${portfolio.totalProfit.toStringAsFixed(0)}'),
          Text('今日盈亏 ${portfolio.dayProfit.toStringAsFixed(0)}'),
          const SizedBox(height: 14),
          const Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _ModuleChip(label: 'Trade Calendar'),
              _ModuleChip(label: 'Position Calculator'),
              _ModuleChip(label: 'Risk Dashboard'),
              _ModuleChip(label: '离线可用'),
              _ModuleChip(label: '真实行情适配层'),
            ],
          ),
        ],
        if (module == '专业K线') ...const [
          Text('日线 / 周线 / 月线'),
          Text('缩放 平移 十字光标'),
          Text('趋势线 水平线 矩形 标注'),
          Text('真实行情与未来预测区域'),
        ],
        if (module == '规则回测') ...const [
          Text('回测统计'),
          Text('命中率 76%'),
          Text('平均误差 2.8%'),
          Text('最大回撤'),
          Text('预测结果新版本'),
        ],
        if (module == '复盘AI') ...const [
          Text('复盘摘要'),
          Text('预测与实际走势对比'),
          Text('AI 仅读取确定性计算结果'),
          Text('用户可编辑或重新生成'),
        ],
        if (module == '复盘AI') ...[Text(review)],
        if (module == '设置后台') ...const [
          Text('指标参数与主题'),
          Text('行情源状态'),
          Text('同步任务失败重试'),
          Text('审计日志和 AI 调用记录'),
        ],
        if (module == '更多') ...[
          _MoreDestination(
            icon: Icons.rule_outlined,
            title: '规则与回测',
            target: '规则回测',
            onNavigate: onNavigate,
          ),
          _MoreDestination(
            icon: Icons.rate_review_outlined,
            title: '复盘与 AI',
            target: '复盘AI',
            onNavigate: onNavigate,
          ),
          _MoreDestination(
            icon: Icons.settings_outlined,
            title: '设置',
            target: '设置后台',
            onNavigate: onNavigate,
          ),
          _MoreDestination(
            icon: Icons.admin_panel_settings_outlined,
            title: '管理后台',
            target: '设置后台',
            onNavigate: onNavigate,
          ),
        ],
      ],
    );
  }
}

class _MoreDestination extends StatelessWidget {
  const _MoreDestination({
    required this.icon,
    required this.title,
    required this.target,
    required this.onNavigate,
  });

  final IconData icon;
  final String title;
  final String target;
  final ValueChanged<String> onNavigate;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      minTileHeight: 56,
      leading: Icon(icon),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => onNavigate(target),
    );
  }
}

class _ModuleChip extends StatelessWidget {
  const _ModuleChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text(label));
  }
}
