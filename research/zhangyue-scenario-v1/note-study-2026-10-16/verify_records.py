"""Validate source-backed note study proposals without altering application tags."""
import collections
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CATALOG = ROOT / 'frontend/src/features/knowledge/note-tag-catalog.json'
TAXONOMY = ROOT / 'frontend/src/features/knowledge/note-tag-taxonomy.json'


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_new(name, value):
    with (HERE / name).open('x') as output:
        json.dump(value, output, ensure_ascii=False, indent=2)
        output.write('\n')


manifest = read(HERE / 'manifest.json')
baseline = read(CATALOG)
taxonomy = read(TAXONOMY)
valid_tags = {tag['id'] for dimension in taxonomy for tag in dimension['options']}
dimensions = {dimension['id'] for dimension in taxonomy}
sources = {item['file']: item for item in manifest['documents']}
assert len(sources) == len(manifest['documents']) == 146
assert {path.name for path in (ROOT / 'notes').glob('*.md')} == set(sources)
assert sha(CATALOG) == manifest['sourceCatalogSha256'], 'Existing application tag seed changed during this study'
assert all(sha(ROOT / 'notes' / name) == item['sourceHash'] for name, item in sources.items()), 'Original note changed'
base_by_file = {item['file']: item for item in baseline['documents']}
valid_roles = {'trend', 'granville_stage', 'parameter_formula', 'method_selection', 'support_resistance', 'mode', 'risk', 'validation', 'context'}
valid_kinds = {'formula', 'condition', 'pattern', 'risk', 'context'}
valid_periods = {'day', '60m', '30m', 'weekly', 'monthly', 'quarterly', 'yearly', 'unknown'}
valid_computability = {'direct', 'needs_definition', 'needs_data', 'reference'}
counts = collections.Counter()


def check_quote(item, lines, where):
    first, last, quote = item['startLine'], item['endLine'], item['quote']
    assert isinstance(first, int) and isinstance(last, int) and 1 <= first <= last <= len(lines), where
    assert isinstance(quote, str) and quote.strip(), where
    assert quote in '\n'.join(lines[first - 1:last]), f'{where}: quote is not in source lines {first}-{last}: {quote!r}'
    counts['sourceQuoteChecks'] += 1


def check_record(record):
    name = record['file']
    assert name in sources, name
    lines = (ROOT / 'notes' / name).read_text().splitlines()
    assert record['sourceHash'] == sources[name]['sourceHash'], name
    assert record['status'] == 'ai_candidate', name
    assert record['readCoverage'] == {'fromLine': 1, 'throughLine': len(lines)}, (name, record['readCoverage'], len(lines))
    assert isinstance(record['summary'], str) and record['summary'].strip(), name
    assert isinstance(record['roles'], list) and set(record['roles']) <= valid_roles, name
    tags = record['tags']
    assert isinstance(tags, list) and tags and len(tags) == len(set(tags)), name
    assert set(tags) <= valid_tags, (name, set(tags) - valid_tags)
    assert {tag.split('.')[0] for tag in tags} == dimensions, (name, 'missing dimension')
    for evidence in record['evidence']:
        assert evidence['tagId'] in tags and evidence['reason'].strip(), name
        check_quote(evidence, lines, name + ':tag:' + evidence['tagId'])
    assert set(tags) == {evidence['tagId'] for evidence in record['evidence']}, name
    for claim in record['claims']:
        assert claim['name'].strip() and claim['kind'] in valid_kinds, (name, claim)
        assert claim['formula'] is None or isinstance(claim['formula'], str) and claim['formula'].strip(), name
        assert claim['computability'] in valid_computability, (name, claim)
        assert set(claim['periods']) <= valid_periods and claim['periods'], (name, claim)
        for key in ('inputs', 'applicability', 'invalidation', 'gaps'):
            assert isinstance(claim[key], list) and all(isinstance(value, str) for value in claim[key]), (name, key)
        assert claim['evidence'], (name, claim['name'])
        for evidence in claim['evidence']:
            check_quote(evidence, lines, name + ':claim:' + claim['name'])
        if claim['computability'] == 'needs_definition':
            assert claim['gaps'], (name, claim['name'], 'missing definition must be named')
        counts['claims'] += 1
    assert isinstance(record['gaps'], list) and isinstance(record['userRuleConflicts'], list), name
    attachments = record['attachments']
    assert isinstance(attachments['present'], bool) and isinstance(attachments['note'], str), name
    if attachments['present']:
        assert attachments['note'].strip(), name
    assert attachments['status'] == ('not_inspected' if attachments['present'] else 'none'), name
    counts['documents'] += 1
    counts['tagAssignments'] += len(tags)


records = []
pending = []
batch_hashes = {}
for group in manifest['batches']:
    path = HERE / f"batch-{group['id']}.json"
    if not path.exists() and '--partial' in sys.argv:
        pending.append(path.name)
        continue
    assert path.exists(), f'Waiting for {path.name}'
    try:
        data = read(path)
    except json.JSONDecodeError:
        if '--partial' in sys.argv:
            pending.append(path.name)
            continue
        raise
    assert data['schemaVersion'] == 1 and data['batchId'] == group['id'] and data['status'] == 'ai_candidate', path.name
    if '--partial' in sys.argv and collections.Counter(record['file'] for record in data['records']) != collections.Counter(group['files']):
        pending.append(path.name)
        continue
    assert collections.Counter(record['file'] for record in data['records']) == collections.Counter(group['files']), path.name
    for record in data['records']:
        check_record(record)
    batch_hashes[path.name] = sha(path)
    records.extend(data['records'])

assert len(records) == len({record['file'] for record in records})
if not pending:
    assert len(records) == len(sources)
records.sort(key=lambda record: record['file'])
result = {'verified': True, 'complete': not pending, 'pendingBatches': pending, **counts, 'originalSourceHashesMatch': True, 'originalTagCatalogUnchanged': True,
          'allSevenTagDimensionsCovered': True, 'allProposalsRemainAICandidates': True,
          'sourceQuoteFailures': 0, 'scope': 'Text evidence and structural audit; semantic proposals remain untested and attachments uninspected.'}

candidate_path = HERE / 'calculation-candidates.json'
if candidate_path.exists():
    calculation_candidates = read(candidate_path)
    candidate_quotes = 0
    for item in calculation_candidates['items']:
        assert item['status'] == 'research_candidate' and item['predictionEffect'] == 'untested' and item['activation'] == 'inactive'
        for evidence in item['evidence']:
            name = evidence['file']
            assert evidence['sourceHash'] == sources[name]['sourceHash']
            lines = (ROOT / 'notes' / name).read_text().splitlines()
            assert evidence['quote'] in '\n'.join(lines[evidence['startLine'] - 1:evidence['endLine']])
            candidate_quotes += 1
    result['calculationResearchEntries'] = len(calculation_candidates['items'])
    result['calculationResearchQuoteChecks'] = candidate_quotes

if '--merge' in sys.argv:
    assert not pending, 'All batches must finish before merging'
    generated = datetime.now(timezone.utc).isoformat()
    merged = []
    for record in records:
        previous = base_by_file[record['file']]
        item = dict(record)
        item['studyId'] = 'note-study:' + hashlib.sha256((record['file'] + ':' + record['sourceHash']).encode()).hexdigest()[:24]
        revision_data = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
        item['studyRevisionId'] = 'note-study-revision:' + hashlib.sha256(revision_data).hexdigest()[:32]
        item['sourceUrl'] = previous['sourceUrl']
        item['originalTagRecordId'] = previous['id']
        item['originalTagVersion'] = previous['version']
        item['originalTagStatus'] = previous['status']
        item['originalTags'] = previous['tags']
        item['tagChanges'] = {'added': sorted(set(item['tags']) - set(previous['tags'])),
                              'removed': sorted(set(previous['tags']) - set(item['tags']))}
        for index, claim in enumerate(item['claims']):
            claim['claimId'] = item['studyRevisionId'] + ':claim-' + str(index + 1)
            claim['evaluationStatus'] = 'untested'
        merged.append(item)
    catalog = {'schemaVersion': 1, 'definitionVersion': 'note-semantic-study-v1', 'generatedAt': generated,
               'status': 'ai_candidate', 'sourceCommit': manifest['sourceCommit'],
               'sourceCatalogSha256': manifest['sourceCatalogSha256'], 'batchSha256': batch_hashes, 'records': merged,
               'activation': 'Research proposals only; existing application tag catalog and user revisions are unchanged.'}
    summary = {'schemaVersion': 1, 'generatedAt': generated, **counts,
               'documentsWithTagChanges': sum(bool(record['tagChanges']['added'] or record['tagChanges']['removed']) for record in merged),
               'documentsWithDefinitionOrDataGaps': sum(bool(record['gaps']) or any(claim['gaps'] for claim in record['claims']) for record in merged),
               'documentsWithUninspectedAttachments': sum(record['attachments']['present'] for record in merged),
               'documentsWithUserRuleConflicts': sum(bool(record['userRuleConflicts']) for record in merged),
               'roleCounts': dict(collections.Counter(role for record in merged for role in set(record['roles']))),
               'claimComputability': dict(collections.Counter(claim['computability'] for record in merged for claim in record['claims'])),
               'studyStatus': 'ai_candidate', 'predictionsImprovementEstablished': False,
               'originalNotesAndApplicationTagsUnchanged': True}
    write_new('study-catalog.json', catalog)
    write_new('summary.json', summary)
    write_new('validation.json', result)
    print(json.dumps({'audit': result, 'summary': summary}, ensure_ascii=False, indent=2))
else:
    merged_path = HERE / 'study-catalog.json'
    if merged_path.exists():
        merged = read(merged_path)
        assert merged['batchSha256'] == batch_hashes, 'A frozen study batch changed after merging'
        assert [record['file'] for record in merged['records']] == [record['file'] for record in records]
        assert all(record['status'] == 'ai_candidate' and record['sourceHash'] == sources[record['file']]['sourceHash'] for record in merged['records'])
        for original, saved in zip(records, merged['records']):
            for key, value in original.items():
                if key != 'claims':
                    assert saved[key] == value, (original['file'], key)
            assert len(saved['claims']) == len(original['claims'])
            for index, (old_claim, saved_claim) in enumerate(zip(original['claims'], saved['claims'])):
                assert all(saved_claim[key] == value for key, value in old_claim.items())
                assert saved_claim['claimId'] == saved['studyRevisionId'] + ':claim-' + str(index + 1)
                assert saved_claim['evaluationStatus'] == 'untested'
    print(json.dumps(result, ensure_ascii=False, indent=2))
