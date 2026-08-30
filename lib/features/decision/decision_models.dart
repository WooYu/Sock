enum DecisionAction { enter, hold, reduce, exit, avoid, wait }

enum StrategyMode {
  baseGranville,
  phase3Opening,
  seaTurtle,
  rebound,
  mirrorRetest,
  sidewaysPhase3,
  monthlyWait,
  demonStock,
  exclusion,
}

class DecisionEvidence {
  DecisionEvidence({required this.id, required this.label, this.detail = ''});

  final String id;
  final String label;
  final String detail;
}

class DecisionCalibration {
  DecisionCalibration({
    required this.sampleCount,
    required this.hitRate,
    required this.meanAbsoluteError,
    required this.meanSlippage,
    required this.maximumDrawdown,
    required this.calibrated,
    this.confidence,
    Map<String, int> invalidationReasons = const {},
  }) : invalidationReasons = Map.unmodifiable(invalidationReasons);

  final int sampleCount;
  final double hitRate;
  final double meanAbsoluteError;
  final double meanSlippage;
  final double maximumDrawdown;
  final bool calibrated;
  final double? confidence;
  final Map<String, int> invalidationReasons;
}

class DecisionCandidate {
  DecisionCandidate({
    required this.ruleId,
    required this.ruleVersion,
    required this.name,
    required this.mode,
    required this.action,
    required this.priority,
    this.timeframe = '日线',
    this.requiredFactsKnown = true,
    List<DecisionEvidence> evidence = const [],
    List<String> invalidationConditions = const [],
    this.calibration,
  }) : evidence = List.unmodifiable(evidence),
       invalidationConditions = List.unmodifiable(invalidationConditions);

  final String ruleId;
  final int ruleVersion;
  final String name;
  final StrategyMode mode;
  final DecisionAction action;
  final int priority;
  final String timeframe;
  final bool requiredFactsKnown;
  final List<DecisionEvidence> evidence;
  final List<String> invalidationConditions;
  final DecisionCalibration? calibration;
}

class DecisionInput {
  DecisionInput({
    required this.dataFresh,
    this.timeframe = '日线',
    this.missingFacts = const [],
    this.holding = false,
    this.hardInvalidations = const [],
    this.exclusions = const [],
    List<DecisionCandidate> candidates = const [],
    this.support,
    this.resistance,
    this.target,
    required this.generatedAt,
  }) : candidates = List.unmodifiable(candidates),
       missingFacts = List.unmodifiable(missingFacts),
       hardInvalidations = List.unmodifiable(hardInvalidations),
       exclusions = List.unmodifiable(exclusions);

  final bool dataFresh;
  final String timeframe;
  final List<String> missingFacts;
  final bool holding;
  final List<String> hardInvalidations;
  final List<String> exclusions;
  final List<DecisionCandidate> candidates;
  final double? support;
  final double? resistance;
  final double? target;
  final DateTime generatedAt;
}

class DecisionResult {
  DecisionResult({
    required this.decision,
    this.primaryMode,
    required this.reason,
    List<DecisionCandidate> matchedRules = const [],
    List<String> missingFacts = const [],
    List<String> conflicts = const [],
    List<String> invalidationConditions = const [],
    this.support,
    this.resistance,
    this.target,
    this.calibration,
    required this.generatedAt,
  }) : matchedRules = List.unmodifiable(matchedRules),
       missingFacts = List.unmodifiable(missingFacts),
       conflicts = List.unmodifiable(conflicts),
       invalidationConditions = List.unmodifiable(invalidationConditions);

  final DecisionAction decision;
  final StrategyMode? primaryMode;
  final String reason;
  final List<DecisionCandidate> matchedRules;
  final List<String> missingFacts;
  final List<String> conflicts;
  final List<String> invalidationConditions;
  final double? support;
  final double? resistance;
  final double? target;
  final DecisionCalibration? calibration;
  final DateTime generatedAt;
}