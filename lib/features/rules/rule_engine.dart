enum RuleField { closeAboveMa20, volumeRatio, supportDistance }

enum RuleOperator {
  equals,
  greaterThan,
  greaterThanOrEqual,
  lessThan,
  lessThanOrEqual,
}

class RuleCondition {
  const RuleCondition({
    required this.field,
    required this.operator,
    required this.value,
  });

  final RuleField field;
  final RuleOperator operator;
  final double value;
}

class RuleFacts {
  const RuleFacts({
    required this.closeAboveMa20,
    required this.volumeRatio,
    required this.supportDistance,
  });

  final bool closeAboveMa20;
  final double volumeRatio;
  final double supportDistance;

  double valueFor(RuleField field) => switch (field) {
    RuleField.closeAboveMa20 => closeAboveMa20 ? 1 : 0,
    RuleField.volumeRatio => volumeRatio,
    RuleField.supportDistance => supportDistance,
  };
}

class RuleVersion {
  RuleVersion({
    required this.id,
    required this.version,
    required this.name,
    required this.priority,
    required this.enabled,
    required this.system,
    required List<RuleCondition> conditions,
    required this.publishedAt,
  }) : conditions = List.unmodifiable(conditions);

  final String id;
  final int version;
  final String name;
  final int priority;
  final bool enabled;
  final bool system;
  final List<RuleCondition> conditions;
  final DateTime publishedAt;
}

class RuleBook {
  RuleBook({required this.idFactory, DateTime Function()? clock})
    : _clock = clock ?? DateTime.now;

  factory RuleBook.withSystemDefaults({String Function()? idFactory}) {
    final book = RuleBook(idFactory: idFactory ?? () => 'system-unused');
    book._history.addAll({
      'system-trend': [
        RuleVersion(
          id: 'system-trend',
          version: 1,
          name: '趋势确认',
          priority: 10,
          enabled: true,
          system: true,
          conditions: const [
            RuleCondition(
              field: RuleField.closeAboveMa20,
              operator: RuleOperator.equals,
              value: 1,
            ),
          ],
          publishedAt: DateTime(2026, 1, 1),
        ),
      ],
      'system-volume': [
        RuleVersion(
          id: 'system-volume',
          version: 1,
          name: '成交量确认',
          priority: 20,
          enabled: true,
          system: true,
          conditions: const [
            RuleCondition(
              field: RuleField.volumeRatio,
              operator: RuleOperator.greaterThanOrEqual,
              value: 1,
            ),
          ],
          publishedAt: DateTime(2026, 1, 1),
        ),
      ],
    });
    return book;
  }

  final String Function() idFactory;
  final DateTime Function() _clock;
  final Map<String, List<RuleVersion>> _history = {};

  List<RuleVersion> get allVersions =>
      List.unmodifiable(_history.values.expand((versions) => versions));

  List<RuleVersion> get latestRules {
    final latest = <String, RuleVersion>{};
    for (final rule in allVersions) {
      final existing = latest[rule.id];
      if (existing == null || rule.version > existing.version) {
        latest[rule.id] = rule;
      }
    }
    final result = latest.values.toList()
      ..sort((a, b) => a.priority.compareTo(b.priority));
    return List.unmodifiable(result);
  }

  void restoreUserVersions(Iterable<RuleVersion> versions) {
    final grouped = <String, List<RuleVersion>>{};
    for (final rule in versions.where((item) => !item.system)) {
      grouped.putIfAbsent(rule.id, () => []).add(rule);
    }
    for (final entry in grouped.entries) {
      entry.value.sort((a, b) => a.version.compareTo(b.version));
      _history[entry.key] = List.unmodifiable(entry.value);
    }
  }

  List<RuleVersion> get activeRules {
    final rules = _history.values
        .where((versions) => versions.isNotEmpty)
        .map((versions) => versions.last)
        .where((rule) => rule.enabled)
        .toList();
    rules.sort((a, b) => a.priority.compareTo(b.priority));
    return List.unmodifiable(rules);
  }

  RuleVersion create({
    required String name,
    required int priority,
    required List<RuleCondition> conditions,
  }) {
    final id = idFactory();
    final rule = RuleVersion(
      id: id,
      version: 1,
      name: name,
      priority: priority,
      enabled: true,
      system: false,
      conditions: conditions,
      publishedAt: _clock(),
    );
    _history[id] = [rule];
    return rule;
  }

  RuleVersion publishVersion(
    String id, {
    required String name,
    required int priority,
    required List<RuleCondition> conditions,
  }) {
    final current = _latest(id);
    return _publish(
      id,
      RuleVersion(
        id: id,
        version: current.version + 1,
        name: name,
        priority: priority,
        enabled: current.enabled,
        system: current.system,
        conditions: conditions,
        publishedAt: _clock(),
      ),
    );
  }

  RuleVersion setEnabled(String id, bool enabled) {
    final current = _latest(id);
    return _publish(
      id,
      RuleVersion(
        id: id,
        version: current.version + 1,
        name: current.name,
        priority: current.priority,
        enabled: enabled,
        system: current.system,
        conditions: current.conditions,
        publishedAt: _clock(),
      ),
    );
  }

  List<RuleVersion> versions(String id) =>
      List.unmodifiable(_history[id] ?? const []);

  bool evaluate(RuleVersion rule, RuleFacts facts) {
    return rule.conditions.every((condition) {
      final actual = facts.valueFor(condition.field);
      return switch (condition.operator) {
        RuleOperator.equals => actual == condition.value,
        RuleOperator.greaterThan => actual > condition.value,
        RuleOperator.greaterThanOrEqual => actual >= condition.value,
        RuleOperator.lessThan => actual < condition.value,
        RuleOperator.lessThanOrEqual => actual <= condition.value,
      };
    });
  }

  RuleVersion _latest(String id) {
    final versions = _history[id];
    if (versions == null || versions.isEmpty) {
      throw ArgumentError.value(id, 'id', '规则不存在');
    }
    return versions.last;
  }

  RuleVersion _publish(String id, RuleVersion rule) {
    _history[id] = [...?_history[id], rule];
    return rule;
  }
}
