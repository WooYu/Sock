import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/decision/decision_engine.dart';
import 'package:stockcal/features/decision/decision_models.dart';

void main() {
  final generatedAt = DateTime(2026, 8, 30, 9);

  DecisionInput input({
    bool dataFresh = true,
    List<String> missingFacts = const [],
    bool holding = false,
    List<String> hardInvalidations = const [],
    List<String> exclusions = const [],
    List<DecisionCandidate> candidates = const [],
  }) => DecisionInput(
    dataFresh: dataFresh,
    missingFacts: missingFacts,
    holding: holding,
    hardInvalidations: hardInvalidations,
    exclusions: exclusions,
    candidates: candidates,
    support: 10,
    resistance: 12,
    target: 13,
    generatedAt: generatedAt,
  );

  DecisionCandidate candidate({
    required String name,
    required DecisionAction action,
    int priority = 10,
    StrategyMode mode = StrategyMode.baseGranville,
  }) => DecisionCandidate(
    ruleId: name,
    ruleVersion: 1,
    name: name,
    mode: mode,
    action: action,
    priority: priority,
    requiredFactsKnown: true,
    evidence: const [],
    invalidationConditions: const ['收盘跌破 MA5'],
  );

  group('DecisionEngine', () {
    test('returns WAIT when required facts are missing', () {
      final result = DecisionEngine().evaluate(
        input(missingFacts: ['板块强弱']),
      );

      expect(result.decision, DecisionAction.wait);
      expect(result.missingFacts, contains('板块强弱'));
    });

    test('returns WAIT when market data is stale', () {
      final result = DecisionEngine().evaluate(input(dataFresh: false));

      expect(result.decision, DecisionAction.wait);
      expect(result.reason, contains('过期'));
    });

    test('returns WAIT when no active rule matches', () {
      final result = DecisionEngine().evaluate(input());

      expect(result.decision, DecisionAction.wait);
      expect(result.reason, contains('规则'));
    });

    test('returns WAIT when top-priority rules conflict', () {
      final result = DecisionEngine().evaluate(
        input(candidates: [
          candidate(name: '趋势进入', action: DecisionAction.enter),
          candidate(name: '破位退出', action: DecisionAction.exit),
        ]),
      );

      expect(result.decision, DecisionAction.wait);
      expect(result.conflicts, containsAll(['趋势进入', '破位退出']));
    });

    test('returns EXIT before other rules when holding and invalidated', () {
      final result = DecisionEngine().evaluate(
        input(
          holding: true,
          hardInvalidations: ['收盘跌破 MA5'],
          candidates: [candidate(name: '趋势继续', action: DecisionAction.hold)],
        ),
      );

      expect(result.decision, DecisionAction.exit);
      expect(result.invalidationConditions, contains('收盘跌破 MA5'));
    });

    test('returns AVOID when an enabled exclusion matches', () {
      final result = DecisionEngine().evaluate(
        input(exclusions: ['命中个人回避过滤器']),
      );

      expect(result.decision, DecisionAction.avoid);
      expect(result.reason, contains('回避'));
    });

    test('returns the single applicable strategy action', () {
      final result = DecisionEngine().evaluate(
        input(
          candidates: [
            candidate(
              name: '站上 MA5 的基础上涨',
              action: DecisionAction.enter,
              mode: StrategyMode.baseGranville,
            ),
          ],
        ),
      );

      expect(result.decision, DecisionAction.enter);
      expect(result.primaryMode, StrategyMode.baseGranville);
      expect(result.matchedRules.single.name, '站上 MA5 的基础上涨');
    });
    test('waits when a matched rule belongs to another timeframe', () {
      final result = DecisionEngine().evaluate(
        input(
          candidates: [
            DecisionCandidate(
              ruleId: 'monthly-rule',
              ruleVersion: 1,
              name: '月线规则',
              mode: StrategyMode.monthlyWait,
              action: DecisionAction.enter,
              priority: 1,
              timeframe: '月线',
            ),
          ],
        ),
      );

      expect(result.decision, DecisionAction.wait);
      expect(result.reason, contains('周期'));
    });
  });
}