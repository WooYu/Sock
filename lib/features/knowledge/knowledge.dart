import 'package:flutter/foundation.dart';

import '../decision/decision_models.dart';
import '../rules/rule_engine.dart';

enum KnowledgeKind { rule, experience, concept }

enum ApprovalStatus { pending, approved, rejected }

enum ExtractionMethod { ai, local }

class KnowledgeSource {
  const KnowledgeSource({
    required this.id,
    required this.title,
    required this.path,
    required this.originalContent,
  });
  final String id;
  final String title;
  final String path;
  final String originalContent;
}

class KnowledgeDraft {
  const KnowledgeDraft({
    required this.id,
    required this.sourceId,
    required this.kind,
    required this.title,
    required this.summary,
    required this.excerpt,
    required this.sourceLine,
    required this.status,
    this.sourceLineEnd,
    this.extractionMethod = ExtractionMethod.local,
    this.conditions = const [],
    this.action = DecisionAction.wait,
    this.mode = StrategyMode.baseGranville,
    this.timeframe = '日线',
    this.priority = 50,
    this.evidenceIds = const [],
  });

  final String id;
  final String sourceId;
  final KnowledgeKind kind;
  final String title;
  final String summary;
  final String excerpt;
  final int sourceLine;
  final int? sourceLineEnd;
  final ApprovalStatus status;
  final ExtractionMethod extractionMethod;
  final List<RuleCondition> conditions;
  final DecisionAction action;
  final StrategyMode mode;
  final String timeframe;
  final int priority;
  final List<String> evidenceIds;

  bool get isExecutableRule =>
      kind == KnowledgeKind.rule &&
      conditions.isNotEmpty &&
      action != DecisionAction.wait;

  KnowledgeDraft approved() => KnowledgeDraft(
    id: id,
    sourceId: sourceId,
    kind: kind,
    title: title,
    summary: summary,
    excerpt: excerpt,
    sourceLine: sourceLine,
    sourceLineEnd: sourceLineEnd,
    status: ApprovalStatus.approved,
    extractionMethod: extractionMethod,
    conditions: conditions,
    action: action,
    mode: mode,
    timeframe: timeframe,
    priority: priority,
    evidenceIds: evidenceIds,
  );
}

class PublishedRule {
  const PublishedRule({
    required this.id,
    required this.name,
    required this.description,
    required this.enabled,
    this.sourceId,
    this.sourceExcerpt = '',
    this.sourceLineStart,
    this.sourceLineEnd,
    this.conditions = const [],
    this.action = DecisionAction.wait,
    this.mode = StrategyMode.baseGranville,
    this.timeframe = '日线',
    this.priority = 50,
    this.evidenceIds = const [],
    this.invalidationConditions = const [],
    this.publishedAt,
  });

  final String id;
  final String? sourceId;
  final String name;
  final String description;
  final bool enabled;
  final String sourceExcerpt;
  final int? sourceLineStart;
  final int? sourceLineEnd;
  final List<RuleCondition> conditions;
  final DecisionAction action;
  final StrategyMode mode;
  final String timeframe;
  final int priority;
  final List<String> evidenceIds;
  final List<String> invalidationConditions;
  final DateTime? publishedAt;

  bool get isExecutable => conditions.isNotEmpty && action != DecisionAction.wait;

  RuleVersion toRuleVersion({DateTime? fallbackPublishedAt}) => RuleVersion(
    id: id,
    version: 1,
    name: name,
    priority: priority,
    enabled: enabled,
    system: false,
    conditions: conditions,
    publishedAt: publishedAt ?? fallbackPublishedAt ?? DateTime.now(),
    action: action,
    mode: mode,
    timeframe: timeframe,
    invalidationConditions: invalidationConditions,
    evidenceIds: evidenceIds,
  );
}

abstract interface class KnowledgeRepository {
  Future<List<KnowledgeSource>> loadSources();
  Future<List<KnowledgeDraft>> loadDrafts();
  Future<List<KnowledgeDraft>> extract(String sourceId);
  Future<KnowledgeDraft> approve(String id);
  Future<void> publishRule(String id);
  Future<void> updateSource(String id, String content);
  Future<void> deleteSource(String id);
  Future<void> updateDraft(String id, String title, String summary);
  Future<List<PublishedRule>> loadRules();
  Future<void> toggleRule(String id, bool enabled);
}

class MemoryKnowledgeRepository implements KnowledgeRepository {
  MemoryKnowledgeRepository({
    List<KnowledgeSource> sources = const [],
    List<KnowledgeDraft> drafts = const [],
  }) : _sources = List.of(sources),
       _drafts = List.of(drafts);

  final List<KnowledgeSource> _sources;
  final List<KnowledgeDraft> _drafts;
  final List<String> publishedRuleIds = [];
  final List<PublishedRule> rules = [];

  @override
  Future<List<KnowledgeSource>> loadSources() async =>
      List.unmodifiable(_sources);

  @override
  Future<List<KnowledgeDraft>> loadDrafts() async =>
      List.unmodifiable(_drafts);

  @override
  Future<List<KnowledgeDraft>> extract(String sourceId) async =>
      List.unmodifiable(_drafts.where((d) => d.sourceId == sourceId));

  @override
  Future<KnowledgeDraft> approve(String id) async {
    final index = _drafts.indexWhere((draft) => draft.id == id);
    if (index < 0) throw StateError('知识条目不存在');
    final value = _drafts[index].approved();
    _drafts[index] = value;
    return value;
  }

  @override
  Future<void> publishRule(String id) async {
    publishedRuleIds.add(id);
    final draft = _drafts.firstWhere((d) => d.id == id);
    rules.removeWhere((rule) => rule.id == id);
    rules.add(
      PublishedRule(
        id: id,
        sourceId: draft.sourceId,
        name: draft.title,
        description: draft.summary,
        enabled: true,
        sourceExcerpt: draft.excerpt,
        sourceLineStart: draft.sourceLine,
        sourceLineEnd: draft.sourceLineEnd,
        conditions: draft.conditions,
        action: draft.action,
        mode: draft.mode,
        timeframe: draft.timeframe,
        priority: draft.priority,
        evidenceIds: draft.evidenceIds,
      ),
    );
  }

  @override
  Future<void> updateSource(String id, String content) async {
    final index = _sources.indexWhere((source) => source.id == id);
    if (index < 0) return;
    final source = _sources[index];
    _sources[index] = KnowledgeSource(
      id: source.id,
      title: source.title,
      path: source.path,
      originalContent: content,
    );
    _drafts.removeWhere((draft) => draft.sourceId == id);
    rules.removeWhere((rule) => rule.sourceId == id);
  }

  @override
  Future<void> deleteSource(String id) async {
    _sources.removeWhere((source) => source.id == id);
    _drafts.removeWhere((draft) => draft.sourceId == id);
    rules.removeWhere((rule) => rule.sourceId == id);
  }

  @override
  Future<void> updateDraft(String id, String title, String summary) async {
    final index = _drafts.indexWhere((draft) => draft.id == id);
    if (index < 0) return;
    final draft = _drafts[index];
    _drafts[index] = KnowledgeDraft(
      id: draft.id,
      sourceId: draft.sourceId,
      kind: draft.kind,
      title: title,
      summary: summary,
      excerpt: draft.excerpt,
      sourceLine: draft.sourceLine,
      sourceLineEnd: draft.sourceLineEnd,
      status: draft.status,
      extractionMethod: draft.extractionMethod,
      conditions: draft.conditions,
      action: draft.action,
      mode: draft.mode,
      timeframe: draft.timeframe,
      priority: draft.priority,
      evidenceIds: draft.evidenceIds,
    );
  }

  @override
  Future<List<PublishedRule>> loadRules() async => List.unmodifiable(rules);

  @override
  Future<void> toggleRule(String id, bool enabled) async {
    final index = rules.indexWhere((rule) => rule.id == id);
    if (index < 0) return;
    final rule = rules[index];
    rules[index] = PublishedRule(
      id: rule.id,
      sourceId: rule.sourceId,
      name: rule.name,
      description: rule.description,
      enabled: enabled,
      sourceExcerpt: rule.sourceExcerpt,
      sourceLineStart: rule.sourceLineStart,
      sourceLineEnd: rule.sourceLineEnd,
      conditions: rule.conditions,
      action: rule.action,
      mode: rule.mode,
      timeframe: rule.timeframe,
      priority: rule.priority,
      evidenceIds: rule.evidenceIds,
      invalidationConditions: rule.invalidationConditions,
      publishedAt: rule.publishedAt,
    );
  }
}

class KnowledgeController extends ChangeNotifier {
  KnowledgeController(this.repository);

  final KnowledgeRepository repository;
  List<KnowledgeSource> sources = const [];
  List<KnowledgeDraft> drafts = const [];
  List<PublishedRule> rules = const [];
  bool loading = false;
  String? error;
  final Set<String> _appliedRuleIds = {};
  String _appliedRulesSignature = '';

  List<KnowledgeDraft> get pending => drafts
      .where((draft) => draft.status == ApprovalStatus.pending)
      .toList(growable: false);

  List<KnowledgeDraft> get approved => drafts
      .where((draft) => draft.status == ApprovalStatus.approved)
      .toList(growable: false);

  KnowledgeSource sourceFor(String id) =>
      sources.firstWhere((source) => source.id == id);

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      sources = await repository.loadSources();
      drafts = await repository.loadDrafts();
      rules = await repository.loadRules();
    } catch (failure) {
      error = failure.toString().replaceFirst('Bad state: ', '');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> approveAndPublish(String id) async {
    final approved = await repository.approve(id);
    if (approved.kind == KnowledgeKind.rule) {
      await repository.publishRule(id);
    }
    await load();
  }

  Future<void> updateSource(String id, String content) async {
    await repository.updateSource(id, content);
    await load();
  }

  Future<void> deleteSource(String id) async {
    await repository.deleteSource(id);
    await load();
  }

  Future<void> updateDraft(String id, String title, String summary) async {
    await repository.updateDraft(id, title, summary);
    await load();
  }

  Future<void> extract(String sourceId) async {
    await repository.extract(sourceId);
    await load();
  }

  Future<void> toggleRule(String id, bool enabled) async {
    await repository.toggleRule(id, enabled);
    await load();
  }

  /// 将用户批准的、带有可验证条件的笔记规则加载到确定性 RuleBook。
  /// 无条件或 WAIT 规则会保留在知识库中，但不会进入可触发集合。
  bool applyPublishedRulesTo(RuleBook book) {
    final signature = rules
        .map(
          (rule) =>
              '${rule.id}:${rule.enabled}:${rule.action.name}:${rule.mode.name}:'
              '${rule.priority}:${rule.conditions.map((c) => '${c.field.name}:${c.operator.name}:${c.value}').join(',')}',
        )
        .join('|');
    if (signature == _appliedRulesSignature) return false;

    book.removeUserVersions(_appliedRuleIds);
    book.restoreUserVersions(
      rules.map((rule) => rule.toRuleVersion()),
    );
    _appliedRuleIds
      ..clear()
      ..addAll(rules.map((rule) => rule.id));
    _appliedRulesSignature = signature;
    return true;
  }
}
