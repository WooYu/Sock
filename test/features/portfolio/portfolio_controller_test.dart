import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/portfolio/portfolio.dart';
import 'package:stockcal/features/portfolio/portfolio_controller.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';
import 'package:stockcal/features/portfolio/persistent_portfolio_repository.dart';

void main() {
  test(
    'live market price updates active portfolio valuation and notifies listeners',
    () {
      final controller = PortfolioController(
        marketPrices: const {},
        idFactory: _sequentialIds(),
      );
      controller.record(
        type: TradeEntryType.buy,
        code: '600519',
        name: '贵州茅台',
        quantity: 100,
        price: 1500,
        fee: 0,
        cashAmount: 0,
        note: '',
      );
      var notifications = 0;
      controller.addListener(() => notifications += 1);

      controller.updateMarketPrice('600519', 1700);

      expect(controller.marketValue, 170000);
      expect(controller.floatingProfit, 20000);
      expect(notifications, 1);
    },
  );

  test('load restores multiple portfolios and their active selection', () async {
    final controller = PortfolioController(
      marketPrices: const {},
      repository: _FixedPortfolioRepository(
        PortfolioSnapshot(
          portfolios: [
            Portfolio(
              id: 'p1',
              name: '长线',
              ledger: PortfolioLedger(openingCash: 100000)
                ..record(
                  TradeEntry.buy(
                    id: 'buy-1',
                    occurredAt: DateTime(2026, 8, 14),
                    code: '000001',
                    name: '平安银行',
                    quantity: 100,
                    price: 10,
                    fee: 0,
                  ),
                ),
            ),
            Portfolio(id: 'p2', name: '波段'),
          ],
          activeId: 'p1',
        ),
      ),
      idFactory: _sequentialIds(),
    );

    await controller.load();

    expect(controller.portfolios.map((p) => p.name), ['长线', '波段']);
    expect(controller.activeId, 'p1');
    expect(controller.ledger.openingCash, 100000);
    expect(controller.ledger.entries.single.id, 'buy-1');
    expect(controller.ledger.cashBalance, 99000);
  });

  test('createPortfolio makes it active and persists the snapshot', () async {
    final repository = _RecordingPortfolioRepository(
      PortfolioSnapshot(portfolios: [Portfolio(id: 'p1', name: '默认')], activeId: 'p1'),
    );
    final controller = PortfolioController(
      marketPrices: const {},
      repository: repository,
      idFactory: _sequentialIds(),
    );
    await controller.load();

    final created = controller.createPortfolio('打新');

    expect(created.name, '打新');
    expect(controller.activeId, created.id);
    expect(controller.portfolios, hasLength(2));
    expect(repository.saved!.portfolios.map((p) => p.name), ['默认', '打新']);
    expect(repository.saved!.activeId, created.id);
  });

  test('renameActivePortfolio updates the active name and persists', () async {
    final repository = _RecordingPortfolioRepository(
      PortfolioSnapshot(portfolios: [Portfolio(id: 'p1', name: '默认')], activeId: 'p1'),
    );
    final controller = PortfolioController(
      marketPrices: const {},
      repository: repository,
      idFactory: _sequentialIds(),
    );
    await controller.load();

    controller.renameActivePortfolio('重命名');

    expect(controller.activePortfolio.name, '重命名');
    expect(repository.saved!.portfolios.single.name, '重命名');
  });

  test('switchPortfolio changes the active ledger', () {
    final a = Portfolio(id: 'p1', name: '长线');
    final b = Portfolio(id: 'p2', name: '波段');
    final controller = PortfolioController(
      marketPrices: const {},
      portfolios: [a, b],
      activeId: 'p1',
    );

    controller.switchPortfolio('p2');

    expect(controller.activeId, 'p2');
    expect(identical(controller.ledger, b.ledger), isTrue);
  });

  test('deleteActivePortfolio removes it, activates another, and keeps one', () {
    final a = Portfolio(id: 'p1', name: '长线');
    final b = Portfolio(id: 'p2', name: '波段');
    final controller = PortfolioController(
      marketPrices: const {},
      portfolios: [a, b],
      activeId: 'p1',
    );

    controller.deleteActivePortfolio();

    expect(controller.portfolios.map((p) => p.id), ['p2']);
    expect(controller.activeId, 'p2');

    expect(
      () => controller.deleteActivePortfolio(),
      throwsA(isA<StateError>()),
    );
  });

  test('aggregate totals sum across all portfolios', () {
    final a = Portfolio(
      id: 'p1',
      name: '长线',
      ledger: PortfolioLedger()
        ..record(
          TradeEntry.buy(
            id: 'a-buy',
            occurredAt: DateTime(2026, 8, 1),
            code: '600519',
            name: '贵州茅台',
            quantity: 10,
            price: 100,
            fee: 0,
          ),
        ),
    );
    final b = Portfolio(
      id: 'p2',
      name: '波段',
      ledger: PortfolioLedger()
        ..record(
          TradeEntry.buy(
            id: 'b-buy',
            occurredAt: DateTime(2026, 8, 1),
            code: '000001',
            name: '平安银行',
            quantity: 20,
            price: 10,
            fee: 0,
          ),
        ),
    );
    final controller = PortfolioController(
      marketPrices: const {'600519': 120, '000001': 15},
      portfolios: [a, b],
      activeId: 'p1',
    );

    expect(controller.totalMarketValue, 1200 + 300);
    expect(controller.totalFloatingProfit, 200 + 100);
  });
}

String Function() _sequentialIds() {
  var next = 0;
  return () => 'id-${next++}';
}

class _FixedPortfolioRepository implements PortfolioRepository {
  _FixedPortfolioRepository(this.snapshot);
  final PortfolioSnapshot snapshot;

  @override
  Future<PortfolioSnapshot> load() async => snapshot;

  @override
  Future<void> save(PortfolioSnapshot snapshot) async {}
}

class _RecordingPortfolioRepository implements PortfolioRepository {
  _RecordingPortfolioRepository(this.snapshot);
  PortfolioSnapshot snapshot;
  PortfolioSnapshot? saved;

  @override
  Future<PortfolioSnapshot> load() async => snapshot;

  @override
  Future<void> save(PortfolioSnapshot snapshot) async {
    saved = snapshot;
  }
}
