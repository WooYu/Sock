import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'watchlist.dart';

class PersistentWatchlistRepository implements WatchlistRepository {
  static const _key = 'stockcal.watchlists.v1';

  @override
  Future<List<WatchGroup>> load() async {
    final value = (await SharedPreferences.getInstance()).getString(_key);
    if (value == null) return [];
    final list = jsonDecode(value) as List<Object?>;
    return list
        .map((item) {
          final json = item! as Map<String, Object?>;
          final stocks = json['stocks']! as List<Object?>;
          return WatchGroup(
            id: json['id']! as String,
            name: json['name']! as String,
            stocks: stocks
                .map((item) {
                  final stock = item! as Map<String, Object?>;
                  return WatchStock(
                    code: stock['code']! as String,
                    name: stock['name']! as String,
                  );
                })
                .toList(growable: false),
          );
        })
        .toList(growable: false);
  }

  @override
  Future<void> save(List<WatchGroup> groups) async {
    final value = jsonEncode([
      for (final group in groups)
        {
          'id': group.id,
          'name': group.name,
          'stocks': [
            for (final stock in group.stocks)
              {'code': stock.code, 'name': stock.name},
          ],
        },
    ]);
    await (await SharedPreferences.getInstance()).setString(_key, value);
  }
}

class PersistentMutationOutbox implements MutationOutbox {
  static const _key = 'stockcal.watchlist_outbox.v1';

  @override
  Future<void> add(PendingMutation mutation) async {
    final current = await loadPending();
    if (current.any((item) => item.idempotencyKey == mutation.idempotencyKey)) {
      return;
    }
    await _save([...current, mutation]);
  }

  @override
  Future<List<PendingMutation>> loadPending() async {
    final value = (await SharedPreferences.getInstance()).getString(_key);
    if (value == null) return [];
    return (jsonDecode(value) as List<Object?>)
        .map((item) {
          final json = item! as Map<String, Object?>;
          return PendingMutation(
            type: MutationType.values.byName(json['type']! as String),
            idempotencyKey: json['idempotencyKey']! as String,
            payload: (json['payload']! as Map<String, Object?>),
          );
        })
        .toList(growable: false);
  }

  @override
  Future<void> acknowledge(String idempotencyKey) async {
    final current = await loadPending();
    await _save(
      current.where((item) => item.idempotencyKey != idempotencyKey).toList(),
    );
  }

  Future<void> _save(List<PendingMutation> mutations) async {
    await (await SharedPreferences.getInstance()).setString(
      _key,
      jsonEncode([
        for (final mutation in mutations)
          {
            'type': mutation.type.name,
            'idempotencyKey': mutation.idempotencyKey,
            'payload': mutation.payload,
          },
      ]),
    );
  }
}
