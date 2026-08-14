import 'dart:async';

import 'package:flutter/material.dart';

import '../../domain/stockcal_domain.dart';
import '../account/account_workspace.dart';
import '../account/persistent_session_repository.dart';
import '../account/remote_auth_service.dart';
import '../account/session.dart';
import '../analysis/stock_analysis_controller.dart';
import '../analysis/stock_analysis_screen.dart';
import '../analysis/technical_analysis.dart';
import '../admin/settings_admin_workspace.dart';
import '../chart/chart_annotations.dart';
import '../chart/professional_chart_screen.dart';
import '../chart/persistent_chart_annotation_store.dart';
import '../market/market_data.dart';
import '../knowledge/knowledge.dart';
import '../knowledge/knowledge_workspace.dart';
import '../knowledge/remote_knowledge_repository.dart';
import '../portfolio/portfolio_controller.dart';
import '../portfolio/persistent_portfolio_repository.dart';
import '../portfolio/portfolio_ledger.dart';
import '../portfolio/portfolio_screen.dart';
import '../rules/rule_engine.dart';
import '../rules/persistent_rules_repository.dart';
import '../rules/persistent_prediction_repository.dart';
import '../rules/rules_workspace.dart';
import '../review/review_workspace.dart';
import '../review/persistent_review_store.dart';
import '../sync/remote_sync_service.dart';
import '../watchlist/watchlist.dart';
import '../watchlist/persistent_watchlist_repository.dart';
import '../watchlist/watchlist_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  var _selected = '总览';
  late final PortfolioController _portfolioController;
  late final StockAnalysisController _stockAnalysisController;
  late final ChartAnnotationController _chartAnnotationController;
  late final RuleBook _ruleBook;
  late final PersistentRuleRepository _ruleRepository;
  late final PersistentPredictionRepository _predictionRepository;
  late final PersistentReviewStore _reviewStore;
  late final KnowledgeController _knowledgeController;
  late final WatchlistController _watchlistController;
  late final SessionController _sessionController;
  late final PersistentChartAnnotationStore _annotationStore;
  late final AnnotationSyncWorker _annotationSyncWorker;

  @override
  void initState() {
    super.initState();
    _portfolioController = PortfolioController(
      ledger: PortfolioLedger(openingCash: 500000),
      marketPrices: const {'600519': 1742, '000001': 14, '300750': 102},
      repository: PersistentPortfolioRepository(),
    );
    _portfolioController.load();
    _stockAnalysisController = StockAnalysisController(
      catalog: const MemoryStockCatalog(DemoAshareData.securities),
      market: DemoAshareMarketAdapter(),
      analyzer: StockAnalyzer(),
    );
    _annotationStore = PersistentChartAnnotationStore();
    _chartAnnotationController = ChartAnnotationController(
      stockCode: '600519',
      repository: _annotationStore,
      outbox: _annotationStore,
      idFactory: () => 'annotation-${DateTime.now().microsecondsSinceEpoch}',
    );
    _ruleBook = RuleBook.withSystemDefaults();
    _ruleRepository = PersistentRuleRepository();
    _predictionRepository = PersistentPredictionRepository();
    _reviewStore = PersistentReviewStore();
    _restoreRules();
    _watchlistController = WatchlistController(
      repository: PersistentWatchlistRepository(),
      outbox: PersistentMutationOutbox(),
    );
    const apiUrl = String.fromEnvironment(
      'STOCKCAL_API_URL',
      defaultValue: 'http://localhost:8080',
    );
    _sessionController = SessionController(
      PersistentSessionRepository(),
      remote: RemoteAuthService(baseUrl: Uri.parse(apiUrl)),
    );
    _knowledgeController = KnowledgeController(
      RemoteKnowledgeRepository(
        baseUrl: Uri.parse(apiUrl),
        accessToken: () => _sessionController.session?.accessToken,
      ),
    );
    _annotationSyncWorker = AnnotationSyncWorker(
      store: _annotationStore,
      remote: RemoteSyncService(baseUrl: Uri.parse(apiUrl)),
    );
    _sessionController.addListener(_syncPending);
    _sessionController.restore();
  }

  @override
  void dispose() {
    _portfolioController.dispose();
    _stockAnalysisController.dispose();
    _chartAnnotationController.dispose();
    _watchlistController.dispose();
    _sessionController.removeListener(_syncPending);
    _sessionController.dispose();
    _knowledgeController.dispose();
    super.dispose();
  }

  void _syncPending() {
    final token = _sessionController.session?.accessToken;
    if (token == null || token.isEmpty) return;
    _annotationSyncWorker.drain(token);
    if (_knowledgeController.sources.isEmpty && !_knowledgeController.loading) {
      unawaited(_knowledgeController.load());
    }
  }

  Future<void> _restoreRules() async {
    await _ruleRepository.restoreInto(_ruleBook);
    if (mounted) setState(() {});
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
            _DesktopNavigation(
              selected: _selected,
              onSelected: (module) => setState(() => _selected = module),
            ),
          Expanded(
            child: _Workspace(
              module: _selected,
              portfolioController: _portfolioController,
              stockAnalysisController: _stockAnalysisController,
              chartAnnotationController: _chartAnnotationController,
              ruleBook: _ruleBook,
              ruleRepository: _ruleRepository,
              predictionRepository: _predictionRepository,
              reviewStore: _reviewStore,
              knowledgeController: _knowledgeController,
              watchlistController: _watchlistController,
              sessionController: _sessionController,
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

class _DesktopNavigation extends StatelessWidget {
  const _DesktopNavigation({required this.selected, required this.onSelected});

  final String selected;
  final ValueChanged<String> onSelected;

  static const _items = <(String, IconData)>[
    ('总览', Icons.dashboard_outlined),
    ('个股分析', Icons.search),
    ('专业K线', Icons.candlestick_chart_outlined),
    ('规则回测', Icons.rule_outlined),
    ('知识规则', Icons.library_books_outlined),
    ('组合交易', Icons.account_balance_wallet_outlined),
    ('自选股', Icons.bookmark_outline),
    ('复盘AI', Icons.rate_review_outlined),
    ('账户同步', Icons.person_outline),
    ('设置后台', Icons.settings_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 152,
      child: Material(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            for (final item in _items)
              ListTile(
                dense: true,
                selected: selected == item.$1,
                leading: Icon(item.$2, size: 21),
                title: Text(item.$1),
                onTap: () => onSelected(item.$1),
              ),
          ],
        ),
      ),
    );
  }
}

class _Workspace extends StatelessWidget {
  const _Workspace({
    required this.module,
    required this.portfolioController,
    required this.stockAnalysisController,
    required this.chartAnnotationController,
    required this.ruleBook,
    required this.ruleRepository,
    required this.predictionRepository,
    required this.reviewStore,
    required this.knowledgeController,
    required this.watchlistController,
    required this.sessionController,
    required this.onNavigate,
  });

  final String module;
  final PortfolioController portfolioController;
  final StockAnalysisController stockAnalysisController;
  final ChartAnnotationController chartAnnotationController;
  final RuleBook ruleBook;
  final PersistentRuleRepository ruleRepository;
  final PersistentPredictionRepository predictionRepository;
  final PersistentReviewStore reviewStore;
  final KnowledgeController knowledgeController;
  final WatchlistController watchlistController;
  final SessionController sessionController;
  final ValueChanged<String> onNavigate;

  @override
  Widget build(BuildContext context) {
    if (module == '组合交易') {
      return PortfolioScreen(controller: portfolioController);
    }
    if (module == '个股分析') {
      return StockAnalysisScreen(
        controller: stockAnalysisController,
        knowledgeController: knowledgeController,
      );
    }
    if (module == '专业K线') {
      return ProfessionalChartScreen(
        stockCode: '600519',
        candles: DemoAshareData.candlesFor('600519'),
        annotationController: chartAnnotationController,
      );
    }
    if (module == '规则回测') {
      return RulesWorkspace(
        ruleBook: ruleBook,
        ruleRepository: ruleRepository,
        predictionRepository: predictionRepository,
        knowledgeController: knowledgeController,
        candles: DemoAshareData.candlesFor('600519'),
      );
    }
    if (module == '复盘AI') {
      return ReviewWorkspace(store: reviewStore);
    }
    if (module == '知识规则') {
      return KnowledgeWorkspace(controller: knowledgeController);
    }
    if (module == '自选股') {
      return WatchlistScreen(controller: watchlistController);
    }
    if (module == '账户同步') {
      return AccountWorkspace(controller: sessionController);
    }
    if (module == '设置后台') {
      return const SettingsAdminWorkspace();
    }
    if (module == '总览') {
      return const _Dashboard();
    }
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(module, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        if (module == '更多') ...[
          _MoreDestination(
            icon: Icons.bookmark_outline,
            title: '自选股',
            target: '自选股',
            onNavigate: onNavigate,
          ),
          _MoreDestination(
            icon: Icons.rule_outlined,
            title: '规则与回测',
            target: '规则回测',
            onNavigate: onNavigate,
          ),
          _MoreDestination(
            icon: Icons.library_books_outlined,
            title: '知识规则',
            target: '知识规则',
            onNavigate: onNavigate,
          ),
          _MoreDestination(
            icon: Icons.person_outline,
            title: '账户与同步',
            target: '账户同步',
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

class _Dashboard extends StatelessWidget {
  const _Dashboard();

  @override
  Widget build(BuildContext context) {
    final portfolio = DemoMarketData.portfolio;
    final prediction = PredictionEngine().predict(
      DemoMarketData.candlesFor('600519'),
    );
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                '组合总览',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ),
            const Chip(
              avatar: Icon(Icons.schedule, size: 16),
              label: Text('延迟 15 分钟'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 24,
          runSpacing: 12,
          children: [
            _Metric(label: '总资产', value: portfolio.marketValue),
            _Metric(label: '累计盈亏', value: portfolio.totalProfit),
            _Metric(label: '今日盈亏', value: portfolio.dayProfit),
          ],
        ),
        const Divider(height: 32),
        const _SectionTitle(title: '持仓与自选'),
        for (final position in portfolio.positions)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('${position.name} ${position.code}'),
            subtitle: Text(
              '持仓 ${position.quantity} · 成本 ${position.costPrice}',
            ),
            trailing: Text(position.lastPrice.toStringAsFixed(2)),
          ),
        const Divider(height: 32),
        const _SectionTitle(title: '关键位提醒'),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.notifications_active_outlined),
          title: const Text('贵州茅台接近压力区'),
          subtitle: Text('压力 ${prediction.resistance.toStringAsFixed(2)}'),
        ),
        const _SectionTitle(title: '最新预测'),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.insights_outlined),
          title: Text('目标 ${prediction.target.toStringAsFixed(2)}'),
          subtitle: Text(
            '置信度 ${(prediction.confidence * 100).round()}% · 3 条规则命中',
          ),
        ),
        const _SectionTitle(title: '待复盘'),
        const ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(Icons.fact_check_outlined),
          title: Text('本周交易复盘'),
          subtitle: Text('1 项待完成'),
        ),
        const SizedBox(height: 8),
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
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          Text(
            value.toStringAsFixed(0),
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8, bottom: 4),
    child: Text(title, style: Theme.of(context).textTheme.titleMedium),
  );
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
