import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/rules/persistent_rules_repository.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  test('custom rule versions and conditions survive recreation', () async {
    SharedPreferences.setMockInitialValues({});
    var sequence = 0;
    final book = RuleBook.withSystemDefaults(
      idFactory: () => 'user-${++sequence}',
    );
    final created = book.create(
      name: '放量突破',
      priority: 30,
      conditions: const [
        RuleCondition(
          field: RuleField.volumeRatio,
          operator: RuleOperator.greaterThanOrEqual,
          value: 1.5,
        ),
      ],
    );
    book.publishVersion(
      created.id,
      name: '放量突破确认',
      priority: 25,
      conditions: const [
        RuleCondition(
          field: RuleField.volumeRatio,
          operator: RuleOperator.greaterThan,
          value: 1.8,
        ),
      ],
    );
    await PersistentRuleRepository().save(book);

    final restored = RuleBook.withSystemDefaults(idFactory: () => 'new');
    await PersistentRuleRepository().restoreInto(restored);

    expect(restored.versions(created.id), hasLength(2));
    expect(restored.versions(created.id).last.name, '放量突破确认');
    expect(restored.versions(created.id).last.conditions.single.value, 1.8);
    expect(restored.activeRules.where((rule) => rule.system), hasLength(2));
  });
}
