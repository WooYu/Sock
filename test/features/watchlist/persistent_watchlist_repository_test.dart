import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/watchlist/persistent_watchlist_repository.dart';
import 'package:stockcal/features/watchlist/watchlist.dart';

void main() {
  test(
    'watchlist groups and explicit stock order survive recreation',
    () async {
      SharedPreferences.setMockInitialValues({});
      final first = PersistentWatchlistRepository();
      await first.save(const [
        WatchGroup(
          id: 'focus',
          name: '重点关注',
          stocks: [
            WatchStock(code: '600519', name: '贵州茅台'),
            WatchStock(code: '300750', name: '宁德时代'),
          ],
        ),
      ]);

      final restored = await PersistentWatchlistRepository().load();
      expect(restored.single.name, '重点关注');
      expect(restored.single.stocks.map((stock) => stock.code), [
        '600519',
        '300750',
      ]);
    },
  );

  test(
    'pending mutations survive recreation and can be acknowledged',
    () async {
      SharedPreferences.setMockInitialValues({});
      final first = PersistentMutationOutbox();
      await first.add(
        const PendingMutation(
          type: MutationType.addWatchStock,
          idempotencyKey: 'watch:add:1',
          payload: {'groupId': 'focus', 'code': '600519'},
        ),
      );

      final restored = PersistentMutationOutbox();
      expect(
        (await restored.loadPending()).single.idempotencyKey,
        'watch:add:1',
      );
      await restored.acknowledge('watch:add:1');
      expect(await PersistentMutationOutbox().loadPending(), isEmpty);
    },
  );
}
