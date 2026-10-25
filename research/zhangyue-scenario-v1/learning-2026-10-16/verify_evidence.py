"""Independently check this offline research record; no application state is written."""
import hashlib
import json
import math
import sys
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def indicators(closes):
    values = {f'ma{n}': math.fsum(closes[-n:]) / n for n in (5, 10, 20)}
    mean = math.fsum(closes[-20:]) / 20
    sd = math.sqrt(math.fsum((value - mean) ** 2 for value in closes[-20:]) / 20)
    return dict(values, bollMiddle=mean, bollUpper=mean + 2 * sd, bollLower=mean - 2 * sd)


def compare(price, actual):
    predicted, target = Fraction(str(price)), Fraction(str(actual))
    error = abs(predicted - target) / target
    return {'relativeError': float(error), 'close': error < Fraction(1, 100), 'exact': predicted == target}


assert not compare(101, 100)['close']
assert not compare(99, 100)['close']
assert compare(100.99, 100)['close']
assert compare(100, 100)['exact']
protocol = read('protocol.json')
source = read('source.json')
candidate = read('candidate.json')
train = read('training-ledger.json')
validation = read('validation-ledger.json')
assert sha('source.json') == protocol['sourceSha256']
assert candidate['trainingSha256'] == sha('training-ledger.json')
assert validation['candidateSha256'] == sha('candidate.json')
assert all(ledger['protocolSha256'] == sha('protocol.json') for ledger in (train, validation))
assert datetime.fromisoformat(candidate['createdAt']) < datetime.fromisoformat(validation['generatedAt'])
assert len(train['records']) == 40 and len(validation['records']) == 20
assert max(protocol['split']['trainingTargets']) < min(protocol['split']['validationTargets'])
assert [row['targetDay'] for row in train['records']] == protocol['split']['trainingTargets']
assert [row['targetDay'] for row in validation['records']] == protocol['split']['validationTargets']
assert all(not ledger['forwardEligible'] and ledger['intraday']['status'] == 'not_evaluated' for ledger in (train, validation))

bars = [bar for bar in source['bars'] if bar['day'] <= protocol['latestCompleteDay']]
assert len({bar['day'] for bar in bars}) == len(bars)
assert all(first['day'] < second['day'] for first, second in zip(bars, bars[1:]))
counts = {'sampleDays': 0, 'formulaReferences': 0, 'mergedGroups': 0, 'priceComparisons': 0}
possible_special_sessions = []

for ledger in (train, validation):
    for row in ledger['records']:
        counts['sampleDays'] += 1
        index = next(i for i, bar in enumerate(bars) if bar['day'] == row['targetDay'])
        history = bars[:index]
        assert history[-1] == row['origin'] and bars[index] == row['actual']
        assert row['cutoff'] == row['origin']['day'] + 'T15:00:00+08:00'
        assert all(bar['day'] < row['targetDay'] for bar in history)
        closes = [bar['close'] for bar in history]
        current, previous, earlier = indicators(closes), indicators(closes[:-1]), indicators(closes[:-2])
        for indicator, value in current.items():
            assert abs(value - row['facts'][indicator]) < 1e-9
        close = Decimal(str(row['origin']['close']))
        lower = (close * Decimal('.90')).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
        upper = (close * Decimal('1.10')).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
        if Decimal(str(row['actual']['low'])) < lower or Decimal(str(row['actual']['high'])) > upper:
            possible_special_sessions.append(row['targetDay'])
        for method, detail in row['refDetails'].items():
            expected = {}
            for horizon in (1, 2, 3):
                if method == 'rolling_close':
                    values = indicators(closes + [closes[-1]] * horizon)
                else:
                    values = {name: value + (value - (earlier[name] if method == 'average_delta' else previous[name]))
                              / (2 if method == 'average_delta' else 1) * horizon for name, value in current.items()}
                valid_bands = values['bollUpper'] >= values['bollMiddle'] >= values['bollLower'] > 0
                for indicator, value in values.items():
                    if value > 0 and (not indicator.startswith('boll') or valid_bands):
                        expected[(indicator, horizon)] = value
            refs = detail['selectedReferences']
            assert {(ref['indicator'], ref['target']['horizon']) for ref in refs} == set(expected)
            for ref in refs:
                assert ref['method'] == method and ref['originBarKey'] == row['origin']['day'] and ref['period'] == 'day'
                assert abs(ref['value'] - expected[(ref['indicator'], ref['target']['horizon'])]) < 1e-9
                counts['formulaReferences'] += 1
            groups = []
            for ref in sorted(refs, key=lambda ref: (ref['value'], ref['id'])):
                if groups and all(abs(ref['value'] - other['value']) / ((ref['value'] + other['value']) / 2)
                                  <= .01 + 8 * math.ulp(1.) for other in groups[-1]):
                    groups[-1].append(ref)
                else:
                    groups.append([ref])
            assert len(groups) == len(detail['mergedLevels'])
            price_ticks = set()
            excluded = set()
            for group, saved in zip(groups, detail['mergedLevels']):
                assert {ref['id'] for ref in group} == set(saved['referenceIds'])
                assert abs(math.fsum(ref['value'] for ref in group) / len(group) - saved['value']) < 1e-10
                counts['mergedGroups'] += 1
                if saved['value'] < float(lower) or saved['value'] > float(upper):
                    excluded.add(saved['id'])
                    continue
                # The frozen app's documented half-up rule tolerates 4 ULPs at a cent boundary.
                scaled = saved['value'] * 100
                tick = math.floor(scaled + .5 + abs(scaled) * math.ulp(1.) * 4)
                if tick != int(close * 100):
                    price_ticks.add(tick)
            assert set(detail['excludedGroupIds']) == excluded
            assert detail['band'] == {'lower': float(lower), 'upper': float(upper)}
            assert {round(level['price'] * 100) for level in row['methods'][method]['levels']} == price_ticks
        for method, result in row['methods'].items():
            if method == 'candidate':
                selected = candidate['methodByDirection'].get(row['directionCandidate'], candidate['defaultMethod'])
                assert result['selectedMethod'] == selected
                assert {key: value for key, value in result.items() if key != 'selectedMethod'} == row['methods'][selected]
            level_results = []
            for level in result['levels']:
                fields = {field: compare(level['price'], row['actual'][field]) for field in protocol['matching']['fields']}
                for field, calculated in fields.items():
                    counts['priceComparisons'] += 1
                    saved = level['fields'][field]
                    assert calculated['close'] == saved['close'] and calculated['exact'] == saved['exact']
                    assert abs(calculated['relativeError'] - saved['relativeError']) < 1e-14
                close_match = any(value['close'] for value in fields.values())
                exact = any(value['exact'] for value in fields.values())
                assert level['close'] == close_match and level['exact'] == exact
                level_results.append((close_match, exact))
            assert result['count'] == len(result['levels'])
            assert result['closeCount'] == sum(value[0] for value in level_results)
            assert result['exactCount'] == sum(value[1] for value in level_results)
            assert result['precision'] == (result['closeCount'] / result['count'] if result['count'] else 0)
            hits = 0
            for target in result['targets']:
                errors = [compare(level['price'], row['actual'][target['field']]) for level in result['levels']]
                covered = any(error['close'] for error in errors)
                assert target['close'] == covered
                if errors:
                    assert abs(min(error['relativeError'] for error in errors) - target['relativeError']) < 1e-14
                else:
                    assert target['relativeError'] is None
                hits += covered
            assert result['targetCount'] == hits and result['coverage'] == hits / 4
    for method, summary in ledger['summary'].items():
        rows = [row['methods'][method] for row in ledger['records']]
        precision = math.fsum(row['precision'] for row in rows) / len(rows)
        coverage = math.fsum(row['coverage'] for row in rows) / len(rows)
        assert abs(precision - summary['meanDailyPrecision']) < 1e-12
        assert abs(coverage - summary['meanDailyCoverage']) < 1e-12
        assert abs((2 * precision * coverage / (precision + coverage) if precision + coverage else 0) - summary['selectionScore']) < 1e-12
        assert sum(row['count'] for row in rows) == summary['totalLevels']
        assert sum(row['closeCount'] for row in rows) == summary['closeLevels']

result = {'verified': True, **counts, 'sourceSha256': sha('source.json'),
          'checks': ['all input prefixes stop before their target day', 'all three formulas independently recomputed with Python',
                     'complete-link 1% groups and means checked', 'bands, exclusions, cents and complete price sets checked',
                     'strict <1% and exact-price comparisons recomputed with Fraction',
                     'per-day and aggregate denominators checked', 'candidate frozen before validation ledger',
                     'training and validation target dates disjoint', 'no live or intraday performance claimed'],
          'possibleSpecialSessionDates': sorted(set(possible_special_sessions)),
          'scopeLimit': 'verifies this 60-day retrospective evidence; not source authority, market prediction advantage or profits'}
if '--write' in sys.argv:
    with (ROOT / 'independent-verification.json').open('x') as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write('\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
