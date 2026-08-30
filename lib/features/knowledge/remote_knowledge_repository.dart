import 'dart:convert';

import 'package:http/http.dart' as http;

import '../decision/decision_models.dart';
import '../rules/rule_engine.dart';
import 'knowledge.dart';

class RemoteKnowledgeRepository implements KnowledgeRepository {
  RemoteKnowledgeRepository({
    required this.baseUrl,
    required this.accessToken,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final String? Function() accessToken;
  final http.Client _client;

  @override
  Future<List<KnowledgeSource>> loadSources() async {
    final response = await _client.get(
      _uri('/api/v1/knowledge/sources'),
      headers: _headers(),
    );
    _ensureSuccess(response);
    return (jsonDecode(response.body) as List<Object?>)
        .cast<Map<String, Object?>>()
        .map(_source)
        .toList(growable: false);
  }

  @override
  Future<List<KnowledgeDraft>> loadDrafts() async {
    final response = await _client.get(
      _uri('/api/v1/knowledge/drafts'),
      headers: _headers(),
    );
    _ensureSuccess(response);
    return (jsonDecode(response.body) as List<Object?>)
        .cast<Map<String, Object?>>()
        .map(_draft)
        .toList(growable: false);
  }

  @override
  Future<List<KnowledgeDraft>> extract(String sourceId) async {
    final response = await _client.post(
      _uri('/api/v1/knowledge/sources/$sourceId/extract'),
      headers: _headers(),
    );
    _ensureSuccess(response);
    return (jsonDecode(response.body) as List<Object?>)
        .cast<Map<String, Object?>>()
        .map(_draft)
        .toList(growable: false);
  }

  @override
  Future<KnowledgeDraft> approve(String id) async {
    final response = await _client.post(
      _uri('/api/v1/knowledge/drafts/$id/approve'),
      headers: _headers(),
    );
    _ensureSuccess(response);
    return _draft(jsonDecode(response.body) as Map<String, Object?>);
  }

  @override
  Future<void> publishRule(String id) async {
    final response = await _client.post(
      _uri('/api/v1/knowledge/drafts/$id/publish'),
      headers: _headers(),
    );
    _ensureSuccess(response);
  }

  @override
  Future<void> updateSource(String id, String content) async {
    final response = await _client.patch(
      _uri('/api/v1/knowledge/sources/$id'),
      headers: _headers(),
      body: jsonEncode({'content': content}),
    );
    _ensureSuccess(response);
  }

  @override
  Future<void> deleteSource(String id) async {
    final response = await _client.delete(
      _uri('/api/v1/knowledge/sources/$id'),
      headers: _headers(),
    );
    _ensureSuccess(response);
  }

  @override
  Future<void> updateDraft(String id, String title, String summary) async {
    final response = await _client.patch(
      _uri('/api/v1/knowledge/drafts/$id'),
      headers: _headers(),
      body: jsonEncode({'title': title, 'summary': summary}),
    );
    _ensureSuccess(response);
  }

  @override
  Future<List<PublishedRule>> loadRules() async {
    final response = await _client.get(
      _uri('/api/v1/knowledge/rules'),
      headers: _headers(),
    );
    _ensureSuccess(response);
    return (jsonDecode(response.body) as List<Object?>)
        .cast<Map<String, Object?>>()
        .map(_rule)
        .toList(growable: false);
  }

  @override
  Future<void> toggleRule(String id, bool enabled) async {
    final response = await _client.patch(
      _uri('/api/v1/knowledge/rules/$id/enabled'),
      headers: _headers(),
      body: jsonEncode({'enabled': enabled}),
    );
    _ensureSuccess(response);
  }

  Uri _uri(String path) => baseUrl.resolve(path);

  Map<String, String> _headers() {
    final token = accessToken();
    if (token == null || token.isEmpty) {
      throw StateError('请先登录后访问知识库');
    }
    return {
      'authorization': 'Bearer $token',
      'content-type': 'application/json',
    };
  }

  void _ensureSuccess(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('知识服务请求失败 (${response.statusCode})');
    }
  }

  KnowledgeSource _source(Map<String, Object?> value) => KnowledgeSource(
    id: value['id']! as String,
    title: value['title']! as String,
    path: value['path']! as String,
    originalContent: value['originalContent']! as String,
  );

  PublishedRule _rule(Map<String, Object?> value) {
    final conditions = _conditions(value['conditions']);
    return PublishedRule(
      id: value['id']! as String,
      sourceId: value['sourceDocumentId'] as String?,
      name: value['name']! as String,
      description: value['description']! as String,
      enabled: value['enabled'] as bool? ?? true,
      sourceExcerpt: value['sourceExcerpt'] as String? ?? '',
      sourceLineStart: (value['sourceLineStart'] as num?)?.toInt(),
      sourceLineEnd: (value['sourceLineEnd'] as num?)?.toInt(),
      conditions: conditions,
      action: conditions.isEmpty ? DecisionAction.wait : _action(value['action']),
      mode: _mode(value['mode']),
      timeframe: value['timeframe'] as String? ?? '日线',
      priority: (value['priority'] as num?)?.toInt() ?? 50,
      evidenceIds: _strings(value['evidenceIds']),
      invalidationConditions: _strings(value['invalidationConditions']),
      strength: value['strength'] as String? ?? 'UNSPECIFIED',
      publishedAt: _date(value['publishedAt']),
    );
  }

  KnowledgeDraft _draft(Map<String, Object?> value) {
    final conditions = _conditions(value['conditions']);
    return KnowledgeDraft(
      id: value['id']! as String,
      sourceId: value['sourceDocumentId']! as String,
      kind: KnowledgeKind.values.byName(
        (value['kind']! as String).toLowerCase(),
      ),
      title: value['title']! as String,
      summary: value['summary']! as String,
      excerpt: value['sourceExcerpt']! as String,
      sourceLine: (value['sourceLineStart']! as num).toInt(),
      sourceLineEnd: (value['sourceLineEnd'] as num?)?.toInt(),
      status: ApprovalStatus.values.byName(
        (value['status']! as String).toLowerCase(),
      ),
      extractionMethod: ExtractionMethod.values.byName(
        ((value['extractionMethod'] as String?) ?? 'LOCAL').toLowerCase(),
      ),
      conditions: conditions,
      action: conditions.isEmpty ? DecisionAction.wait : _action(value['action']),
      mode: _mode(value['mode']),
      timeframe: value['timeframe'] as String? ?? '日线',
      priority: (value['priority'] as num?)?.toInt() ?? 50,
      evidenceIds: _strings(value['evidenceIds']),
      invalidationConditions: _strings(value['invalidationConditions']),
      strength: value['strength'] as String? ?? 'UNSPECIFIED',
    );
  }

  List<RuleCondition> _conditions(Object? raw) {
    if (raw is! List<Object?>) return const [];
    final parsed = <RuleCondition>[];
    for (final item in raw) {
      if (item is! Map) return const [];
      final fieldName = item['field'];
      final operatorName = item['operator'];
      final value = item['value'];
      if (fieldName is! String || operatorName is! String || value is! num) {
        return const [];
      }
      try {
        parsed.add(
          RuleCondition(
            field: RuleField.values.byName(fieldName),
            operator: RuleOperator.values.byName(operatorName),
            value: value.toDouble(),
          ),
        );
      } on ArgumentError {
        return const [];
      }
    }
    return List.unmodifiable(parsed);
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

  StrategyMode _mode(Object? raw) => switch ((raw as String?)?.toUpperCase()) {
    'PHASE3_OPENING' => StrategyMode.phase3Opening,
    'SEA_TURTLE' => StrategyMode.seaTurtle,
    'REBOUND' => StrategyMode.rebound,
    'MIRROR_RETEST' => StrategyMode.mirrorRetest,
    'SIDEWAYS_PHASE3' => StrategyMode.sidewaysPhase3,
    'MONTHLY_WAIT' => StrategyMode.monthlyWait,
    'DEMON_STOCK' => StrategyMode.demonStock,
    'EXCLUSION' => StrategyMode.exclusion,
    _ => StrategyMode.baseGranville,
  };

  DateTime? _date(Object? raw) =>
      raw is String ? DateTime.tryParse(raw) : null;
}
