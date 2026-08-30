import '../decision/decision_models.dart';

enum RuleField {
  closeAboveMa20,
  volumeRatio,
  supportDistance,
  closeAboveMa5,
  closeAboveBollMiddle,
  ma5SlopePositive,
  bollMiddleSlopePositive,
  granvilleDay,
  phase,
  marketPanic,
  relativeStrength,
  phase3Opening,
  mirrorRetest,
}

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
    this.closeAboveMa5,
    this.closeAboveBollMiddle,
    this.ma5SlopePositive,
    this.bollMiddleSlopePositive,
    this.granvilleDay,
    this.phase,
    this.marketPanic,
    this.relativeStrength,
    this.phase3Opening,
    this.mirrorRetest,
  });

  final bool closeAboveMa20;
  final double volumeRatio;
  final double supportDistance;
  final bool? closeAboveMa5;
  final bool? closeAboveBollMiddle;
  final bool? ma5SlopePositive;
  final bool? bollMiddleSlopePositive;
  final double? granvilleDay;
  final double? phase;
  final bool? marketPanic;
  final double? relativeStrength;
  final bool? phase3Opening;
  final bool? mirrorRetest;

  double? valueFor(RuleField field) => switch (field) {
    RuleField.closeAboveMa20 => closeAboveMa20 ? 1 : 0,
    RuleField.volumeRatio => volumeRatio,
    RuleField.supportDistance => supportDistance,
    RuleField.closeAboveMa5 => _boolValue(closeAboveMa5),
    RuleField.closeAboveBollMiddle => _boolValue(closeAboveBollMiddle),
    RuleField.ma5SlopePositive => _boolValue(ma5SlopePositive),
    RuleField.bollMiddleSlopePositive => _boolValue(bollMiddleSlopePositive),
    RuleField.granvilleDay => granvilleDay,
    RuleField.phase => phase,
    RuleField.marketPanic => _boolValue(marketPanic),
    RuleField.relativeStrength => relativeStrength,
    RuleField.phase3Opening => _boolValue(phase3Opening),
    RuleField.mirrorRetest => _boolValue(mirrorRetest),
  };

  static double? _boolValue(bool? value) => value == null ? null : value ? 1 : 0;
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
    this.action = DecisionAction.enter,
    this.mode = StrategyMode.baseGranville,
    this.timeframe = '日线',
    List<String> invalidationConditions = const [],
    List<String> evidenceIds = const [],
  }) : conditions = List.unmodifiable(conditions),
       invalidationConditions = List.unmodifiable(invalidationConditions),
       evidenceIds = List.unmodifiable(evidenceIds);

  final String id;
  final int version;
  final String name;
  final int priority;
  final bool enabled;
  final bool system;
  final List<RuleCondition> conditions;
  final DateTime publishedAt;
  final DecisionAction action;
  final StrategyMode mode;
  final String timeframe;
  final List<String> invalidationConditions;
  final List<String> evidenceIds;
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
          action: DecisionAction.enter,
          mode: StrategyMode.baseGranville,
          invalidationConditions: const ['收盘跌破 MA20'],
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
          action: DecisionAction.enter,
          mode: StrategyMode.baseGranville,
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

  List<RuleVersion> matching(RuleFacts facts) => activeRules
      .where((rule) => evaluate(rule, facts))
      .toList(growable: false);

  RuleVersion create({
    required String name,
    required int priority,
    required List<RuleCondition> conditions,
    DecisionAction action = DecisionAction.enter,
    StrategyMode mode = StrategyMode.baseGranville,
    String timeframe = '日线',
    List<String> invalidationConditions = const [],
    List<String> evidenceIds = const [],
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
      action: action,
      mode: mode,
      timeframe: timeframe,
      invalidationConditions: invalidationConditions,
      evidenceIds: evidenceIds,
    );
    _history[id] = [rule];
    return rule;
  }

  RuleVersion publishVersion(
    String id, {
    required String name,
    required int priority,
    required List<RuleCondition> conditions,
    DecisionAction? action,
    StrategyMode? mode,
    String? timeframe,
    List<String>? invalidationConditions,
    List<String>? evidenceIds,
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
        action: action ?? current.action,
        mode: mode ?? current.mode,
        timeframe: timeframe ?? current.timeframe,
        invalidationConditions:
            invalidationConditions ?? current.invalidationConditions,
        evidenceIds: evidenceIds ?? current.evidenceIds,
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
        action: current.action,
        mode: current.mode,
        timeframe: current.timeframe,
        invalidationConditions: current.invalidationConditions,
        evidenceIds: current.evidenceIds,
      ),
    );
  }

  List<RuleVersion> versions(String id) =>
      List.unmodifiable(_history[id] ?? const []);

  bool evaluate(RuleVersion rule, RuleFacts facts) {
    return rule.conditions.every((condition) {
      final actual = facts.valueFor(condition.field);
      if (actual == null) return false;
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