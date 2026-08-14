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
    'conditions': [
      for (final condition in rule.conditions)
        {
          'field': condition.field.name,
          'operator': condition.operator.name,
          'value': condition.value,
        },
    ],
  };

  RuleVersion _fromJson(Map<String, Object?> json) => RuleVersion(
    id: json['id']! as String,
    version: json['version']! as int,
    name: json['name']! as String,
    priority: json['priority']! as int,
    enabled: json['enabled']! as bool,
    system: false,
    conditions: (json['conditions']! as List<Object?>)
        .map((item) {
          final condition = item! as Map<String, Object?>;
          return RuleCondition(
            field: RuleField.values.byName(condition['field']! as String),
            operator: RuleOperator.values.byName(
              condition['operator']! as String,
            ),
            value: (condition['value']! as num).toDouble(),
          );
        })
        .toList(growable: false),
    publishedAt: DateTime.parse(json['publishedAt']! as String),
  );
}
