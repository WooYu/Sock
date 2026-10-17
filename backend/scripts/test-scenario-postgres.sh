#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The existing local PostgreSQL service is reused; all mutations are isolated to this schema.
scenario_schema="scenario_test_$(date +%s)_${RANDOM}_$$"
scenario_container="${SCENARIO_TEST_POSTGRES_CONTAINER:-stockcal-postgres}"
scenario_user="${DATABASE_USER:-stockcal}"
scenario_database="${SCENARIO_TEST_DATABASE:-stockcal}"
[[ "$scenario_schema" =~ ^scenario_test_[0-9_]+$ ]] || exit 2
scenario_psql() { docker exec "$scenario_container" psql -v ON_ERROR_STOP=1 -U "$scenario_user" -d "$scenario_database" "$@"; }
scenario_psql -Atc 'select version()' | head -1
scenario_psql -c "create schema $scenario_schema" >/dev/null
trap 'scenario_psql -c "drop schema if exists $scenario_schema cascade" >/dev/null 2>&1' EXIT
export SCENARIO_TEST_SCHEMA="$scenario_schema"
export SCENARIO_TEST_DATABASE_URL="${SCENARIO_TEST_DATABASE_BASE_URL:-jdbc:postgresql://127.0.0.1:5432/stockcal}?currentSchema=$scenario_schema"
export JAVA_HOME="${JAVA_HOME:-/workspace/toolchains/java21}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/.cache/gradle}"
if (($# == 0)); then set -- --tests 'com.stockcal.scenario.*PostgresTest'; fi
bash gradlew --max-workers=4 test --rerun-tasks "$@"
python3 - <<'PY'
import glob,xml.etree.ElementTree as E
files=glob.glob('build/test-results/test/TEST-com.stockcal.scenario.*PostgresTest.xml')
count=sum(int(E.parse(p).getroot().get('tests','0'))-int(E.parse(p).getroot().get('skipped','0')) for p in files)
assert count>0,'No real PostgreSQL tests executed'
print(f'Real PostgreSQL verification: {count} executed tests')
PY
