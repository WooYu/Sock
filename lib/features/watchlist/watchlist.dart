import 'package:flutter/foundation.dart';

class WatchStock {
  const WatchStock({required this.code, required this.name});

  final String code;
  final String name;
}

class WatchGroup {
  const WatchGroup({
    required this.id,
    required this.name,
    required this.stocks,
  });

  final String id;
  final String name;
  final List<WatchStock> stocks;

  WatchGroup copyWith({String? name, List<WatchStock>? stocks}) => WatchGroup(
    id: id,
    name: name ?? this.name,
    stocks: stocks ?? this.stocks,
  );
}

enum MutationType {
  createWatchGroup,
  addWatchStock,
  removeWatchStock,
  reorderWatchStock,
}

class PendingMutation {
  const PendingMutation({
    required this.type,
    required this.idempotencyKey,
    required this.payload,
  });

  final MutationType type;
  final String idempotencyKey;
  final Map<String, Object?> payload;
}

abstract interface class MutationOutbox {
  Future<void> add(PendingMutation mutation);
}

class MemoryMutationOutbox implements MutationOutbox {
  final List<PendingMutation> _pending = [];

  List<PendingMutation> get pending => List.unmodifiable(_pending);

  @override
  Future<void> add(PendingMutation mutation) async {
    if (_pending.any(
      (item) => item.idempotencyKey == mutation.idempotencyKey,
    )) {
      return;
    }
    _pending.add(mutation);
  }
}

abstract interface class WatchlistRepository {
  Future<List<WatchGroup>> load();
  Future<void> save(List<WatchGroup> groups);
}

class MemoryWatchlistRepository implements WatchlistRepository {
  List<WatchGroup> _groups = [];

  @override
  Future<List<WatchGroup>> load() async => _copy(_groups);

  @override
  Future<void> save(List<WatchGroup> groups) async {
    _groups = _copy(groups);
  }

  List<WatchGroup> _copy(List<WatchGroup> groups) => groups
      .map((group) => group.copyWith(stocks: List.of(group.stocks)))
      .toList();
}

class WatchlistController extends ChangeNotifier {
  WatchlistController({required this.repository, required this.outbox});

  final WatchlistRepository repository;
  final MutationOutbox outbox;
  List<WatchGroup> groups = [];

  Future<void> load() async {
    groups = await repository.load();
    notifyListeners();
  }

  Future<void> createGroup(String name) async {
    final id = 'group-${name.hashCode.abs()}';
    if (groups.any((group) => group.id == id)) return;
    groups = [...groups, WatchGroup(id: id, name: name, stocks: const [])];
    await _persist(
      PendingMutation(
        type: MutationType.createWatchGroup,
        idempotencyKey: 'watchlist:group:$id',
        payload: {'id': id, 'name': name},
      ),
    );
  }

  Future<void> addStock({
    required String groupId,
    required WatchStock stock,
  }) async {
    final index = groups.indexWhere((group) => group.id == groupId);
    if (index < 0) {
      groups = [
        ...groups,
        WatchGroup(id: groupId, name: '重点关注', stocks: const []),
      ];
    }
    final targetIndex = groups.indexWhere((group) => group.id == groupId);
    final group = groups[targetIndex];
    if (group.stocks.any((item) => item.code == stock.code)) return;
    _replace(targetIndex, group.copyWith(stocks: [...group.stocks, stock]));
    await _persist(
      PendingMutation(
        type: MutationType.addWatchStock,
        idempotencyKey: 'watchlist:add:$groupId:${stock.code}',
        payload: {'groupId': groupId, 'code': stock.code, 'name': stock.name},
      ),
    );
  }

  Future<void> removeStock({
    required String groupId,
    required String code,
  }) async {
    final index = groups.indexWhere((group) => group.id == groupId);
    if (index < 0) return;
    final group = groups[index];
    _replace(
      index,
      group.copyWith(
        stocks: group.stocks.where((stock) => stock.code != code).toList(),
      ),
    );
    await _persist(
      PendingMutation(
        type: MutationType.removeWatchStock,
        idempotencyKey: 'watchlist:remove:$groupId:$code',
        payload: {'groupId': groupId, 'code': code},
      ),
    );
  }

  Future<void> moveStock({
    required String groupId,
    required int from,
    required int to,
  }) async {
    final index = groups.indexWhere((group) => group.id == groupId);
    if (index < 0) return;
    final group = groups[index];
    final stocks = List<WatchStock>.of(group.stocks);
    final stock = stocks.removeAt(from);
    stocks.insert(to, stock);
    _replace(index, group.copyWith(stocks: stocks));
    await _persist(
      PendingMutation(
        type: MutationType.reorderWatchStock,
        idempotencyKey:
            'watchlist:order:$groupId:${stocks.map((item) => item.code).join('-')}',
        payload: {
          'groupId': groupId,
          'codes': stocks.map((item) => item.code).toList(),
        },
      ),
    );
  }

  void _replace(int index, WatchGroup group) {
    groups = List.of(groups)..[index] = group;
  }

  Future<void> _persist(PendingMutation mutation) async {
    await repository.save(groups);
    await outbox.add(mutation);
    notifyListeners();
  }
}
