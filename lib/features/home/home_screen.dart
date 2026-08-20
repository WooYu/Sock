import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/display.dart';
import '../../widgets/error_state.dart';
import '../../widgets/metric_card.dart';
import '../account/account_workspace.dart';
import '../account/persistent_session_repository.dart';
import '../account/remote_auth_service.dart';
import '../account/session.dart';
import '../analysis/stock_analysis_controller.dart';
import '../analysis/stock_analysis_screen.dart';
import '../analysis/technical_analysis.dart';
import '../admin/settings_admin_workspace.dart';
import '../admin/remote_admin_service.dart';
import '../chart/chart_annotations.dart';
import '../chart/professional_chart_screen.dart';
import '../chart/persistent_chart_annotation_store.dart';
import '../market/market_data.dart';
import '../market/remote_market_service.dart';
import '../knowledge/knowledge.dart';
import '../knowledge/knowledge_workspace.dart';
import '../knowledge/remote_knowledge_repository.dart';
import '../portfolio/portfolio_controller.dart';
import '../portfolio/persistent_portfolio_repository.dart';
import '../portfolio/portfolio_screen.dart';
import '../preferences/preferences_controller.dart';
import '../rules/rule_engine.dart';
import '../rules/persistent_rules_repository.dart';
import '../rules/persistent_prediction_repository.dart';
import '../rules/rules_workspace.dart';
import '../review/review_workspace.dart';
import '../review/persistent_review_store.dart';
import '../review/remote_review_explanation_adapter.dart';
import '../sync/remote_sync_service.dart';
import '../watchlist/watchlist.dart';
import '../watchlist/persistent_watchlist_repository.dart';
import '../watchlist/watchlist_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.preferences});

  final PreferencesController? preferences;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  var _selected = '行情';
  var _chartStockCode = '600519';
  late final PortfolioController _portfolioController;
  late final StockAnalysisController _stockAnalysisController;
  late final RemoteMarketService _marketService;
  late final RemoteAdminService _adminService;
  late final ChartAnnotationController _chartAnnotationController;
  late final RuleBook _ruleBook;
  late final PersistentRuleRepository _ruleRepository;
  late final PersistentPredictionRepository _predictionRepository;
  late final PersistentReviewStore _reviewStore;
  late final RemoteReviewExplanationAdapter _reviewExplanation;
  late final KnowledgeController _knowledgeController;
  late final WatchlistController _watchlistController;
  late final SessionController _sessionController;
  late final PersistentChartAnnotationStore _annotationStore;
  late final AnnotationSyncWorker _annotationSyncWorker;

  @override
  void initState() {
    super.initState();
    const apiUrl = String.fromEnvironment(
      'STOCKCAL_API_URL',
      defaultValue: 'http://localhost:8080',
    );
    _sessionController = SessionController(
      PersistentSessionRepository(),
      remote: RemoteAuthService(baseUrl: Uri.parse(apiUrl)),
    );
    _marketService = RemoteMarketService(
      baseUrl: Uri.parse(apiUrl),
      accessToken: () => _sessionController.session?.accessToken,
    );
    _adminService = RemoteAdminService(
      baseUrl: Uri.parse(apiUrl),
      accessToken: () => _sessionController.session?.accessToken,
    );
    _portfolioController = PortfolioController(
      marketPrices: const {},
      repository: PersistentPortfolioRepository(),
    );
    unawaited(_restorePortfolio());
    _stockAnalysisController = StockAnalysisController(
      catalog: _marketService,
      market: _marketService,
      analyzer: StockAnalyzer(),
    );
    _stockAnalysisController.addListener(_onAnalysisSelectionChanged);
    widget.preferences?.addListener(_applyIndicatorSettings);
    _applyIndicatorSettings();
    _annotationStore = PersistentChartAnnotationStore();
    _chartAnnotationController = ChartAnnotationController(
      stockCode: _chartStockCode,
      repository: _annotationStore,
      outbox: _annotationStore,
      idFactory: () => 'annotation-${DateTime.now().microsecondsSinceEpoch}',
    );
    _ruleBook = RuleBook.withSystemDefaults();
    _ruleRepository = PersistentRuleRepository();
    _predictionRepository = PersistentPredictionRepository();
    _reviewStore = PersistentReviewStore();
    _reviewExplanation = RemoteReviewExplanationAdapter(
      baseUrl: Uri.parse(apiUrl),
      accessToken: () => _sessionController.session?.accessToken,
    );
    _restoreRules();
    _watchlistController = WatchlistController(
      repository: PersistentWatchlistRepository(),
      outbox: PersistentMutationOutbox(),
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
    widget.preferences?.removeListener(_applyIndicatorSettings);
    _portfolioController.dispose();
    _stockAnalysisController.removeListener(_onAnalysisSelectionChanged);
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
    unawaited(_refreshPortfolioPrices());
    if (_knowledgeController.sources.isEmpty && !_knowledgeController.loading) {
      unawaited(_knowledgeController.load());
    }
    if (_stockAnalysisController.results.isEmpty) {
      unawaited(_stockAnalysisController.search(''));
    }
  }

  void _applyIndicatorSettings() {
    final preferences = widget.preferences;
    if (preferences == null) return;
    final analyzer = _stockAnalysisController.analyzer;
    final settings = preferences.preferences.indicatorSettings;
    if (analyzer.settings == settings) return;
    analyzer.settings = settings;
    if (_stockAnalysisController.analysis != null) {
      unawaited(_stockAnalysisController.refresh());
    }
  }

  void _onAnalysisSelectionChanged() {
    final selected = _stockAnalysisController.selected;
    if (selected != null && selected.code != _chartStockCode) {
      _chartStockCode = selected.code;
      _chartAnnotationController.switchStock(_chartStockCode);
    }
  }

  Future<void> _restorePortfolio() async {
    await _portfolioController.load();
    await _refreshPortfolioPrices();
  }

  Future<void> _refreshPortfolioPrices() async {
    if (_sessionController.session?.isSignedIn != true) return;
    final codes = _portfolioController.positions
        .map((item) => item.code)
        .toSet();
    await Future.wait([
      for (final code in codes)
        _marketService
            .snapshot(code)
            .then(
              (snapshot) => _portfolioController.updateMarketPrice(
                code,
                snapshot.quote.price,
              ),
              onError: (_) {},
            ),
    ]);
  }

  Future<void> _restoreRules() async {
    await _ruleRepository.restoreInto(_ruleBook);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 600;
    final mobileIndex = switch (_selected) {
      '行情' => 0,
      '自选' => 1,
      '组合' => 2,
      _ => 3,
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
              marketService: _marketService,
              chartAnnotationController: _chartAnnotationController,
              chartStockCode: _chartStockCode,
              ruleBook: _ruleBook,
              ruleRepository: _ruleRepository,
              predictionRepository: _predictionRepository,
              reviewStore: _reviewStore,
              reviewExplanation: _reviewExplanation,
              knowledgeController: _knowledgeController,
              watchlistController: _watchlistController,
              sessionController: _sessionController,
              adminService: _adminService,
              preferences: widget.preferences,
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
                const destinations = ['行情', '自选', '组合', '我的'];
                setState(() => _selected = destinations[index]);
              },
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.candlestick_chart_outlined),
                  label: '行情',
                ),
                NavigationDestination(
                  icon: Icon(Icons.bookmark_outline),
                  label: '自选',
                ),
                NavigationDestination(
                  icon: Icon(Icons.account_balance_wallet_outlined),
                  label: '组合',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  label: '我的',
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
    ('行情', Icons.candlestick_chart_outlined),
    ('自选', Icons.bookmark_outline),
    ('组合', Icons.account_balance_wallet_outlined),
    ('我的', Icons.person_outline),
  ];

  @override
  Widget build(BuildContext context) {
    final isPrimary = _items.any((item) => item.$1 == selected);
    final effectiveSelected = isPrimary ? selected : '我的';
    return SizedBox(
      width: 168,
      child: Material(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            for (final item in _items)
              ListTile(
                dense: true,
                selected: effectiveSelected == item.$1,
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
    required this.marketService,
    required this.chartAnnotationController,
    required this.chartStockCode,
    required this.ruleBook,
    required this.ruleRepository,
    required this.predictionRepository,
    required this.reviewStore,
    required this.reviewExplanation,
    required this.knowledgeController,
    required this.watchlistController,
    required this.sessionController,
    required this.adminService,
    this.preferences,
    required this.onNavigate,
  });

  final String module;
  final PortfolioController portfolioController;
  final StockAnalysisController stockAnalysisController;
  final RemoteMarketService marketService;
  final ChartAnnotationController chartAnnotationController;
  final String chartStockCode;
  final RuleBook ruleBook;
  final PersistentRuleRepository ruleRepository;
  final PersistentPredictionRepository predictionRepository;
  final PersistentReviewStore reviewStore;
  final RemoteReviewExplanationAdapter reviewExplanation;
  final KnowledgeController knowledgeController;
  final WatchlistController watchlistController;
  final SessionController sessionController;
  final RemoteAdminService adminService;
  final PreferencesController? preferences;
  final ValueChanged<String> onNavigate;

  @override
  Widget build(BuildContext context) {
    if (module == '组合') {
      return PortfolioScreen(controller: portfolioController);
    }
    if (module == '行情') {
      return _MarketWorkspace(
        portfolioController: portfolioController,
        stockAnalysisController: stockAnalysisController,
        knowledgeController: knowledgeController,
        sessionController: sessionController,
        onNavigate: onNavigate,
      );
    }
    if (module == '专业K线') {
      return _MarketSnapshotLoader(
        market: marketService,
        stockCode: chartStockCode,
        builder: (snapshot) => ProfessionalChartScreen(
          stockCode: chartStockCode,
          candles: snapshot.dailyCandles,
          annotationController: chartAnnotationController,
        ),
      );
    }
    if (module == '规则回测') {
      return _MarketSnapshotLoader(
        market: marketService,
        stockCode: chartStockCode,
        builder: (snapshot) => RulesWorkspace(
          ruleBook: ruleBook,
          ruleRepository: ruleRepository,
          predictionRepository: predictionRepository,
          knowledgeController: knowledgeController,
          candles: snapshot.dailyCandles,
          stockCode: chartStockCode,
        ),
      );
    }
    if (module == '复盘AI') {
      return ReviewWorkspace(
        store: reviewStore,
        trades: portfolioController.ledger.entries,
        explanationAdapter: reviewExplanation,
      );
    }
    if (module == '知识规则') {
      return KnowledgeWorkspace(controller: knowledgeController);
    }
    if (module == '自选') {
      return WatchlistScreen(
        controller: watchlistController,
        catalog: marketService,
      );
    }
    if (module == '账户同步') {
      return AccountWorkspace(controller: sessionController);
    }
    if (module == '设置后台' || module == '管理后台') {
      return SettingsAdminWorkspace(
        remote: adminService,
        sessionController: sessionController,
        preferences: preferences,
        ruleBook: ruleBook,
        ruleRepository: ruleRepository,
        initialTabIndex: module == '管理后台' ? 1 : 0,
      );
    }
    if (module == '我的') {
      return _MyPage(onNavigate: onNavigate);
    }
    return StockAnalysisScreen(
      controller: stockAnalysisController,
      knowledgeController: knowledgeController,
    );
  }
}

class _MyPage extends StatelessWidget {
  const _MyPage({required this.onNavigate});

  final ValueChanged<String> onNavigate;

  static const _items = <(String, String, IconData)>[
    ('复盘 AI', '复盘AI', Icons.rate_review_outlined),
    ('规则回测', '规则回测', Icons.rule_outlined),
    ('知识规则', '知识规则', Icons.library_books_outlined),
    ('账户同步', '账户同步', Icons.person_outline),
    ('设置', '设置后台', Icons.settings_outlined),
    ('管理后台', '管理后台', Icons.admin_panel_settings_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('我的', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          mainAxisExtent: 72,
          children: [
            for (final item in _items)
              Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => onNavigate(item.$2),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        Icon(item.$3, size: 24),
                        const SizedBox(width: 12),
                        Text(item.$1),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _MarketWorkspace extends StatelessWidget {
  const _MarketWorkspace({
    required this.portfolioController,
    required this.stockAnalysisController,
    required this.knowledgeController,
    required this.sessionController,
    required this.onNavigate,
  });

  final PortfolioController portfolioController;
  final StockAnalysisController stockAnalysisController;
  final KnowledgeController knowledgeController;
  final SessionController sessionController;
  final ValueChanged<String> onNavigate;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([stockAnalysisController, sessionController]),
      builder: (context, _) {
        final signedIn = sessionController.session?.isSignedIn == true;
        final idle =
            stockAnalysisController.selected == null &&
            stockAnalysisController.results.isEmpty;
        return Column(
          children: [
            if (!signedIn)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        const Icon(Icons.login, size: 26),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            '登录以获取行情与 AI 分析',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        const SizedBox(width: 12),
                        FilledButton(
                          onPressed: () => onNavigate('账户同步'),
                          child: const Text('去登录'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            Expanded(
              child: idle
                  ? _Dashboard(
                      portfolioController: portfolioController,
                      stockAnalysisController: stockAnalysisController,
                    )
                  : StockAnalysisScreen(
                      controller: stockAnalysisController,
                      knowledgeController: knowledgeController,
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _MarketSnapshotLoader extends StatefulWidget {
  const _MarketSnapshotLoader({
    required this.market,
    required this.stockCode,
    required this.builder,
  });

  final AShareMarketAdapter market;
  final String stockCode;
  final Widget Function(MarketSnapshot snapshot) builder;

  @override
  State<_MarketSnapshotLoader> createState() => _MarketSnapshotLoaderState();
}

class _MarketSnapshotLoaderState extends State<_MarketSnapshotLoader> {
  late Future<MarketSnapshot> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = widget.market.snapshot(widget.stockCode);
  }

  void _retry() => setState(_load);

  @override
  Widget build(BuildContext context) => FutureBuilder<MarketSnapshot>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.hasData) return widget.builder(snapshot.data!);
      if (snapshot.hasError) {
        final error = snapshot.error;
        final message = switch (error) {
          MarketLoadException e => e.message,
          StateError e => e.message.toString(),
          _ => '行情加载失败，请稍后重试',
        };
        return ErrorState(message: message, onRetry: _retry);
      }
      return const Center(child: CircularProgressIndicator());
    },
  );
}

class _Dashboard extends StatelessWidget {
  const _Dashboard({
    required this.portfolioController,
    required this.stockAnalysisController,
  });

  final PortfolioController portfolioController;
  final StockAnalysisController stockAnalysisController;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: portfolioController,
    builder: (context, _) => ListenableBuilder(
      listenable: stockAnalysisController,
      builder: (context, _) => _content(context),
    ),
  );

  Widget _content(BuildContext context) {
    final positions = portfolioController.positions;
    final analysis = stockAnalysisController.analysis;
    final source = stockAnalysisController.snapshot?.source;
    final totalAssets =
        portfolioController.ledger.cashBalance +
        portfolioController.marketValue;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        TextField(
          key: const Key('stock-search'),
          onChanged: stockAnalysisController.search,
          decoration: const InputDecoration(
            labelText: '搜索 A 股',
            hintText: '代码、名称或拼音',
            prefixIcon: Icon(Icons.search),
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                '组合总览',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ),
            Chip(
              avatar: Icon(
                source == null ? Icons.cloud_off_outlined : Icons.schedule,
                size: 16,
              ),
              label: Text(source == null ? '行情待连接' : source.name),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            MetricCard(label: '总资产', value: totalAssets.toStringAsFixed(0)),
            MetricCard(
              label: '累计盈亏',
              value: portfolioController.totalProfit.toStringAsFixed(0),
              color: pnlColor(context, portfolioController.totalProfit),
            ),
            MetricCard(
              label: '浮动盈亏',
              value: portfolioController.floatingProfit.toStringAsFixed(0),
              color: pnlColor(context, portfolioController.floatingProfit),
            ),
          ],
        ),
        const Divider(height: 32),
        const _SectionTitle(title: '持仓与自选'),
        if (positions.isEmpty)
          const ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.account_balance_wallet_outlined),
            title: Text('暂无持仓'),
            subtitle: Text('交易记录保存后将在这里汇总'),
          ),
        for (final position in positions)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('${position.name} ${position.code}'),
            subtitle: Text(
              '持仓 ${position.quantity} · 成本 ${position.averageCost.toStringAsFixed(2)}',
            ),
            trailing: Text(position.marketPrice.toStringAsFixed(2)),
          ),
        const Divider(height: 32),
        const _SectionTitle(title: '关键位提醒'),
        if (analysis == null)
          const ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.notifications_none_outlined),
            title: Text('加载真实行情后显示关键位提醒'),
          )
        else
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.notifications_active_outlined),
            title: const Text('当前股票关键位'),
            subtitle: Text('压力 ${analysis.resistance.toStringAsFixed(2)}'),
          ),
        const _SectionTitle(title: '最新预测'),
        if (analysis == null)
          const ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.insights_outlined),
            title: Text('暂无预测'),
            subtitle: Text('请先加载行情并生成不可变预测版本'),
          )
        else
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.insights_outlined),
            title: Text('目标 ${analysis.target.toStringAsFixed(2)}'),
            subtitle: Text(
              '置信度 ${(analysis.confidence * 100).round()}% · ${analysis.matchedRules.length} 条规则命中',
            ),
          ),
        const _SectionTitle(title: '待复盘'),
        const ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(Icons.fact_check_outlined),
          title: Text('本周交易复盘'),
          subtitle: Text('暂无待完成项目'),
        ),
      ],
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
