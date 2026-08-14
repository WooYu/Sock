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

abstract interface class KnowledgeRepository {
  Future<List<KnowledgeSource>> loadSources();
  Future<List<KnowledgeDraft>> loadDrafts();
  Future<KnowledgeDraft> approve(String id);
  Future<void> publishRule(String id);
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
  Future<void> publishRule(String id) async => publishedRuleIds.add(id);
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
