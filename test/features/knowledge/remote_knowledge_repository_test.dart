import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/decision/decision_models.dart';
import 'package:stockcal/features/knowledge/knowledge.dart';
import 'package:stockcal/features/knowledge/remote_knowledge_repository.dart';

void main() {
  test(
    'loads sources and sends authenticated approval and publication',
    () async {
      final requests = <http.Request>[];
      final client = MockClient((request) async {
        requests.add(request);
        if (request.url.path.endsWith('/sources')) {
          return http.Response(
            jsonEncode([
              {
                'id': 's1',
                'title': '关键点',
                'path': '股票/关键点.md',
                'originalContent': '关键点规则：触达目标位减仓。',
              },
            ]),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        if (request.url.path.endsWith('/approve')) {
          return http.Response(
            jsonEncode({
              'id': 'd1',
              'sourceDocumentId': 's1',
              'kind': 'RULE',
              'title': '减仓',
              'summary': '触达目标位减仓',
              'sourceExcerpt': '触达目标位减仓',
              'sourceLineStart': 1,
              'status': 'APPROVED',
              'extractionMethod': 'AI',
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        return http.Response('{}', 201);
      });
      final repository = RemoteKnowledgeRepository(
        baseUrl: Uri.parse('http://localhost:8080'),
        accessToken: () => 'token-1',
        client: client,
      );

      final sources = await repository.loadSources();
      final approved = await repository.approve('d1');
      await repository.publishRule('d1');

      expect(sources.single.originalContent, contains('目标位'));
      expect(approved.extractionMethod, ExtractionMethod.ai);
      expect(requests, hasLength(3));
      expect(
        requests.every(
          (request) => request.headers['authorization'] == 'Bearer token-1',
        ),
        isTrue,
      );
      expect(requests.last.url.path, endsWith('/drafts/d1/publish'));
    },
  );

  test('hydrates structured conditions, strategy metadata, and evidence', () async {
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/rules')) {
        return http.Response(
          jsonEncode([
            {
              'id': 'rule-2',
              'sourceDocumentId': 's1',
              'name': '趋势确认',
              'description': '站上 MA5 并放量',
              'enabled': true,
              'sourceExcerpt': '站上 MA5 并放量',
              'sourceLineStart': 4,
              'sourceLineEnd': 4,
              'conditions': [
                {
                  'field': 'closeAboveMa5',
                  'operator': 'equals',
                  'value': 1,
                },
                {
                  'field': 'volumeRatio',
                  'operator': 'greaterThanOrEqual',
                  'value': 1.2,
                },
              ],
              'action': 'ENTER',
              'mode': 'PHASE3_OPENING',
              'timeframe': '日线',
              'priority': 12,
              'evidenceIds': ['source:4-4'],
              'invalidationConditions': ['收盘跌破 MA5'],
              'strength': 'PRINCIPLE',
              'publishedAt': '2026-08-30T00:00:00Z',
            },
          ]),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }
      return http.Response('[]', 200);
    });
    final repository = RemoteKnowledgeRepository(
      baseUrl: Uri.parse('http://localhost:8080'),
      accessToken: () => 'token-1',
      client: client,
    );

    final rule = (await repository.loadRules()).single;

    expect(rule.action, DecisionAction.enter);
    expect(rule.mode, StrategyMode.phase3Opening);
    expect(rule.conditions, hasLength(2));
    expect(rule.invalidationConditions, ['收盘跌破 MA5']);
    expect(rule.strength, 'PRINCIPLE');
    expect(rule.evidenceIds, ['source:4-4']);
  });
}
