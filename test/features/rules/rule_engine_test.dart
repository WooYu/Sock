import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  group('RuleBook', () {
    late RuleBook ruleBook;

    setUp(() {
      ruleBook = RuleBook(
        idFactory: _Ids(['rule-1', 'rule-2']).next,
        clock: () => DateTime(2026, 8, 14, 9),
      );
    });

    test('contains enabled immutable system rules ordered by priority', () {
      final rules = RuleBook.withSystemDefaults().activeRules;

      expect(rules, isNotEmpty);
      expect(rules, everyElement(isA<RuleVersion>()));
      expect(
        rules,
        everyElement(
          predicate<RuleVersion>((rule) => rule.system && rule.enabled),
        ),
      );
      expect(
        rules.map((rule) => rule.priority),
        orderedEquals([...rules.map((rule) => rule.priority)]..sort()),
      );
    });

    test('creates structured user rule and evaluates all conditions', () {
      final rule = ruleBook.create(
        name: '趋势放量',
        priority: 20,
        conditions: const [
          RuleCondition(
            field: RuleField.closeAboveMa20,
            operator: RuleOperator.equals,
            value: 1,
          ),
          RuleCondition(
            field: RuleField.volumeRatio,
            operator: RuleOperator.greaterThanOrEqual,
            value: 1.2,
          ),
        ],
      );

      expect(rule.version, 1);
      expect(
        ruleBook.evaluate(
          rule,
          const RuleFacts(
            closeAboveMa20: true,
            volumeRatio: 1.3,
            supportDistance: 0.04,
          ),
        ),
        isTrue,
      );
      expect(
        ruleBook.evaluate(
          rule,
          const RuleFacts(
            closeAboveMa20: true,
            volumeRatio: 1.1,
            supportDistance: 0.04,
          ),
        ),
        isFalse,
      );
    });

    test('editing publishes a new version and preserves the old version', () {
      final first = ruleBook.create(
        name: '接近支撑',
        priority: 10,
        conditions: const [
          RuleCondition(
            field: RuleField.supportDistance,
            operator: RuleOperator.lessThan,
            value: 0.05,
          ),
        ],
      );

      final second = ruleBook.publishVersion(
        first.id,
        name: '临近支撑',
        priority: 8,
        conditions: const [
          RuleCondition(
            field: RuleField.supportDistance,
            operator: RuleOperator.lessThanOrEqual,
            value: 0.03,
          ),
        ],
      );

      expect(first.version, 1);
      expect(second.version, 2);
      expect(ruleBook.versions(first.id), [first, second]);
      expect(ruleBook.activeRules.single, second);
    });

    test('enable state changes through a new version', () {
      final first = ruleBook.create(
        name: '量比确认',
        priority: 30,
        conditions: const [
          RuleCondition(
            field: RuleField.volumeRatio,
            operator: RuleOperator.greaterThan,
            value: 1,
          ),
        ],
      );

      final disabled = ruleBook.setEnabled(first.id, false);

      expect(disabled.version, 2);
      expect(disabled.enabled, isFalse);
      expect(ruleBook.activeRules, isEmpty);
      expect(ruleBook.versions(first.id).first.enabled, isTrue);
    });

    test('latestRules exposes one entry per rule at its highest version', () {
      final first = ruleBook.create(
        name: '趋势放量',
        priority: 20,
        conditions: const [
          RuleCondition(
            field: RuleField.volumeRatio,
            operator: RuleOperator.greaterThan,
            value: 1,
          ),
        ],
      );
      ruleBook.publishVersion(
        first.id,
        name: '趋势放量二',
        priority: 18,
        conditions: const [
          RuleCondition(
            field: RuleField.volumeRatio,
            operator: RuleOperator.greaterThan,
            value: 1.2,
          ),
        ],
      );
      final second = ruleBook.create(
        name: '接近支撑',
        priority: 10,
        conditions: const [
          RuleCondition(
            field: RuleField.supportDistance,
            operator: RuleOperator.lessThan,
            value: 0.05,
          ),
        ],
      );

      final latest = ruleBook.latestRules;

      expect(latest.map((rule) => rule.id), containsAll([first.id, second.id]));
      expect(latest, hasLength(2));
      expect(
        latest.firstWhere((rule) => rule.id == first.id).version,
        2,
      );
    });

    test('system defaults expose two rule templates', () {
      final latest = RuleBook.withSystemDefaults().latestRules;

      expect(latest, hasLength(2));
      expect(latest, everyElement(predicate<RuleVersion>((rule) => rule.system)));
    });
  });
}

class _Ids {
  _Ids(this.values);
  final List<String> values;
  int index = 0;
  String next() => values[index++];
}
