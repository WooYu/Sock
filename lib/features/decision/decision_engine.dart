import 'decision_models.dart';

class DecisionEngine {
  DecisionResult evaluate(DecisionInput input) {
    if (!input.dataFresh) {
      return _wait(input, '行情数据已过期，等待刷新后再判断');
    }
    if (input.missingFacts.isNotEmpty) {
      return _wait(
        input,
        '必要条件不完整，等待补齐：${input.missingFacts.join('、')}',
        missingFacts: input.missingFacts,
      );
    }
    if (input.holding && input.hardInvalidations.isNotEmpty) {
      return DecisionResult(
        decision: DecisionAction.exit,
        reason: '持仓已触发硬性失效：${input.hardInvalidations.join('、')}',
        invalidationConditions: input.hardInvalidations,
        support: input.support,
        resistance: input.resistance,
        target: null,
        generatedAt: input.generatedAt,
      );
    }
    if (input.exclusions.isNotEmpty) {
      return DecisionResult(
        decision: DecisionAction.avoid,
        reason: '命中个人回避过滤器：${input.exclusions.join('、')}',
        support: input.support,
        resistance: input.resistance,
        target: input.target,
        generatedAt: input.generatedAt,
      );
    }

    final applicable = input.candidates
        .where(
          (candidate) =>
              candidate.requiredFactsKnown &&
              candidate.timeframe == input.timeframe,
        )
        .toList(growable: false);
    if (applicable.isEmpty) {
      return _wait(
        input,
        input.candidates.isEmpty
            ? '当前没有已确认的适用规则，等待方向确认'
            : '当前周期没有适用规则，等待切换到对应周期',
      );
    }

    final highestPriority = applicable
        .map((candidate) => candidate.priority)
        .reduce((a, b) => a < b ? a : b);
    final top = applicable
        .where((candidate) => candidate.priority == highestPriority)
        .toList(growable: false);
    final actions = top.map((candidate) => candidate.action).toSet();
    if (actions.length > 1) {
      return _wait(
        input,
        '最高优先级规则存在冲突，等待确认：${top.map((candidate) => candidate.name).join('、')}',
        matchedRules: top,
        conflicts: top.map((candidate) => candidate.name).toList(),
      );
    }

    final selected = top.first;
    return DecisionResult(
      decision: selected.action,
      primaryMode: selected.mode,
      reason: '命中规则：${top.map((candidate) => candidate.name).join('、')}',
      matchedRules: top,
      invalidationConditions: selected.invalidationConditions,
      support: input.support,
      resistance: input.resistance,
      target: input.target,
      calibration: selected.calibration,
      generatedAt: input.generatedAt,
    );
  }

  DecisionResult _wait(
    DecisionInput input,
    String reason, {
    List<DecisionCandidate> matchedRules = const [],
    List<String> missingFacts = const [],
    List<String> conflicts = const [],
  }) => DecisionResult(
    decision: DecisionAction.wait,
    reason: reason,
    matchedRules: matchedRules,
    missingFacts: missingFacts,
    conflicts: conflicts,
    support: input.support,
    resistance: input.resistance,
    target: null,
    generatedAt: input.generatedAt,
  );
}