import 'package:flutter/foundation.dart';

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
    this.extractionMethod = ExtractionMethod.local,
  });
  final String id;
  final String sourceId;
  final KnowledgeKind kind;
  final String title;
  final String summary;
  final String excerpt;
  final int sourceLine;
  final ApprovalStatus status;
  final ExtractionMethod extractionMethod;

  KnowledgeDraft approved() => KnowledgeDraft(
    id: id,
    sourceId: sourceId,
    kind: kind,
    title: title,
    summary: summary,
    excerpt: excerpt,
    sourceLine: sourceLine,
    status: ApprovalStatus.approved,
    extractionMethod: extractionMethod,
  );
}

class PublishedRule {
  const PublishedRule({
    required this.id,
    required this.name,
    required this.description,
    required this.enabled,
  });
  final String id;
  final String name;
  final String description;
  final bool enabled;
}

abstract interface class KnowledgeRepository {
  Future<List<KnowledgeSource>> loadSources();
  Future<List<KnowledgeDraft>> loadDrafts();
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
  Future<List<KnowledgeDraft>> loadDrafts() async => List.unmodifiable(_drafts);
  @override
  Future<KnowledgeDraft> approve(String id) async {
    final index = _drafts.indexWhere((draft) => draft.id == id);
    final value = _drafts[index].approved();
    _drafts[index] = value;
    return value;
  }

  @override
  Future<void> publishRule(String id) async {
    publishedRuleIds.add(id);
    final d = _drafts.firstWhere((d) => d.id == id);
    rules.add(PublishedRule(id: id, name: d.title, description: d.summary, enabled: true));
  }

  @override
  Future<void> updateSource(String id, String content) async {
    final i = _sources.indexWhere((s) => s.id == id);
    if (i >= 0) {
      final s = _sources[i];
      _sources[i] = KnowledgeSource(
        id: s.id,
        title: s.title,
        path: s.path,
        originalContent: content,
      );
    }
  }

  @override
  Future<void> deleteSource(String id) async {
    _sources.removeWhere((s) => s.id == id);
    _drafts.removeWhere((d) => d.sourceId == id);
  }

  @override
  Future<void> updateDraft(String id, String title, String summary) async {
    final i = _drafts.indexWhere((d) => d.id == id);
    if (i >= 0) {
      final d = _drafts[i];
      _drafts[i] = KnowledgeDraft(
        id: d.id,
        sourceId: d.sourceId,
        kind: d.kind,
        title: title,
        summary: summary,
        excerpt: d.excerpt,
        sourceLine: d.sourceLine,
        status: d.status,
        extractionMethod: d.extractionMethod,
      );
    }
  }

  @override
  Future<List<PublishedRule>> loadRules() async => List.unmodifiable(rules);

  @override
  Future<void> toggleRule(String id, bool enabled) async {
    final i = rules.indexWhere((r) => r.id == id);
    if (i >= 0) {
      final r = rules[i];
      rules[i] = PublishedRule(
        id: r.id,
        name: r.name,
        description: r.description,
        enabled: enabled,
      );
    }
  }
}

class KnowledgeController extends ChangeNotifier {
  KnowledgeController(this.repository);
  final KnowledgeRepository repository;
  List<KnowledgeSource> sources = const [];
  List<KnowledgeDraft> drafts = const [];
  bool loading = false;
  String? error;

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
    } catch (failure) {
      error = failure.toString().replaceFirst('Bad state: ', '');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> approveAndPublish(String id) async {
    final approved = await repository.approve(id);
    if (approved.kind == KnowledgeKind.rule) await repository.publishRule(id);
    final index = drafts.indexWhere((draft) => draft.id == id);
    drafts = [...drafts]..[index] = approved;
    notifyListeners();
  }
}
