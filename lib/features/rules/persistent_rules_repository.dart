import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'rule_engine.dart';

class PersistentRuleRepository {
  static const _key = 'stockcal.rules.v1';

  Future<void> save(RuleBook book) async {
    final rules = book.allVersions.where((rule) => !rule.system);
    await (await SharedPreferences.getInstance()).setString(
      _key,
      jsonEncode(rules.map(_toJson).toList(growable: false)),
    );
  }

  Future<void> restoreInto(RuleBook book) async {
    final value = (await SharedPreferences.getInstance()).getString(_key);
    if (value == null) return;
    final rules = (jsonDecode(value) as List<Object?>).map(
      (item) => _fromJson(item! as Map<String, Object?>),
    );
    book.restoreUserVersions(rules);
  }

  Map<String, Object?> _toJson(RuleVersion rule) => {
    'id': rule.id,
    'version': rule.version,
    'name': rule.name,
    'priority': rule.priority,
    'enabled': rule.enabled,
    'publishedAt': rule.publishedAt.toIso8601String(),
    'action': rule.action.name,
    'mode': rule.mode.name,
    'timeframe': rule.timeframe,
    'invalidationConditions': rule.invalidationConditions,
    'evidenceIds': rule.evidenceIds,
    'conditions': [
      for (final condition in rule.conditions)
        {
          'field': condition.field.name,
          'operator': condition.operator.name,
          'value': condition.value,
        },
    ],
  };

  RuleVersion _fromJson(Map<String, Object?> json) {
    final conditions = _conditions(json['conditions']);
    return RuleVersion(
      id: json['id']! as String,
      version: (json['version']! as num).toInt(),
      name: json['name']! as String,
      priority: (json['priority']! as num).toInt(),
      enabled: json['enabled'] as bool? ?? true,
      system: false,
      conditions: conditions,
      publishedAt: DateTime.parse(json['publishedAt']! as String),
      action: conditions.isEmpty
          ? DecisionAction.wait
          : _action(json['action']),
      mode: _mode(json['mode']),
      timeframe: json['timeframe'] as String? ?? '日线',
      invalidationConditions: _strings(json['invalidationConditions']),
      evidenceIds: _strings(json['evidenceIds']),
    );
  }

  List<RuleCondition> _conditions(Object? raw) {
    if (raw is! List<Object?>) return const [];
    final result = <RuleCondition>[];
    for (final item in raw) {
      if (item is! Map) return const [];
      final field = item['field'];
      final operator = item['operator'];
      final value = item['value'];
      if (field is! String || operator is! String || value is! num) {
        return const [];
      }
      try {
        result.add(
          RuleCondition(
            field: RuleField.values.byName(field),
            operator: RuleOperator.values.byName(operator),
            value: value.toDouble(),
          ),
        );
      } on ArgumentError {
        return const [];
      }
    }
    return List.unmodifiable(result);
  }

  List<String> _strings(Object? raw) {
    if (raw is! List<Object?>) return const [];
    return raw.whereType<String>().toList(growable: false);
  }

  DecisionAction _action(Object? raw) {
    if (raw is! String) return DecisionAction.wait;
    try {
      return DecisionAction.values.byName(raw.toLowerCase());
    } on ArgumentError {
      return DecisionAction.wait;
    }
  }

  StrategyMode _mode(Object? raw) => switch ((raw as String?)?.toLowerCase()) {
    'phase3opening' => StrategyMode.phase3Opening,
    'seaturtle' => StrategyMode.seaTurtle,
    'rebound' => StrategyMode.rebound,
    'mirroreretest' => StrategyMode.mirrorRetest,
    'sidewaysphase3' => StrategyMode.sidewaysPhase3,
    'monthlywait' => StrategyMode.monthlyWait,
    'demonstock' => StrategyMode.demonStock,
    'exclusion' => StrategyMode.exclusion,
    _ => StrategyMode.baseGranville,
  };
}
