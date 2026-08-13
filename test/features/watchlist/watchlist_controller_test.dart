import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/watchlist/watchlist.dart';

void main() {
  test('adds a stock once and queues an idempotent sync mutation', () async {
    final outbox = MemoryMutationOutbox();
    final controller = WatchlistController(
      repository: MemoryWatchlistRepository(),
      outbox: outbox,
    );

    await controller.load();
    await controller.addStock(
      groupId: 'focus',
      stock: const WatchStock(code: '600519', name: '贵州茅台'),
    );
    await controller.addStock(
      groupId: 'focus',
      stock: const WatchStock(code: '600519', name: '贵州茅台'),
    );

    expect(controller.groups.single.stocks, hasLength(1));
    expect(outbox.pending, hasLength(1));
    expect(outbox.pending.single.idempotencyKey, 'watchlist:add:focus:600519');
  });

  test('creates groups and preserves explicit stock order', () async {
    final controller = WatchlistController(
      repository: MemoryWatchlistRepository(),
      outbox: MemoryMutationOutbox(),
    );
    await controller.load();
    await controller.createGroup('今日观察');
    final group = controller.groups.single;
    await controller.addStock(
      groupId: group.id,
      stock: const WatchStock(code: '000001', name: '平安银行'),
    );
    await controller.addStock(
      groupId: group.id,
      stock: const WatchStock(code: '300750', name: '宁德时代'),
    );

    await controller.moveStock(groupId: group.id, from: 1, to: 0);

    expect(controller.groups.single.stocks.map((stock) => stock.code), [
      '300750',
      '000001',
    ]);
  });

  test('removing a stock updates local state and queues a mutation', () async {
    final outbox = MemoryMutationOutbox();
    final controller = WatchlistController(
      repository: MemoryWatchlistRepository(),
      outbox: outbox,
    );
    await controller.load();
    await controller.createGroup('持仓跟踪');
    final groupId = controller.groups.single.id;
    await controller.addStock(
      groupId: groupId,
      stock: const WatchStock(code: '600519', name: '贵州茅台'),
    );

    await controller.removeStock(groupId: groupId, code: '600519');

    expect(controller.groups.single.stocks, isEmpty);
    expect(outbox.pending.last.type, MutationType.removeWatchStock);
  });
}
