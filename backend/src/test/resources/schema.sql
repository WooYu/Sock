create table if not exists sync_change (
    cursor bigint generated always as identity primary key,
    user_id varchar(100) not null,
    idempotency_key varchar(180) not null,
    entity_type varchar(50) not null,
    entity_id varchar(180) not null,
    operation varchar(30) not null,
    revision bigint not null,
    payload varchar(10000) not null,
    changed_at timestamp with time zone not null default current_timestamp,
    unique (user_id, idempotency_key)
);

create table if not exists sync_mutation (
    id varchar(36) primary key,
    user_id varchar(36) not null
);

create table if not exists app_user (
    id varchar(36) primary key,
    phone varchar(20) not null unique,
    display_name varchar(100) not null,
    role varchar(20) not null default 'USER',
    enabled boolean not null default true,
    created_at timestamp with time zone not null default current_timestamp
);

create table if not exists device_session (
    id varchar(36) primary key,
    user_id varchar(36) not null,
    device_name varchar(120) not null,
    refresh_token_hash varchar(128) not null unique,
    last_seen_at timestamp with time zone not null,
    revoked_at timestamp with time zone
);

create table if not exists access_token (
    token_hash varchar(128) primary key,
    phone varchar(20) not null,
    expires_at timestamp with time zone not null
);

create table if not exists sms_challenge (
    phone varchar(20) primary key,
    code_hash varchar(128) not null,
    expires_at timestamp with time zone not null,
    requested_at timestamp with time zone not null,
    attempts integer not null,
    consumed_at timestamp with time zone
);

create table if not exists knowledge_source (
    id varchar(36) primary key, source_path varchar(1000) not null, title varchar(500) not null,
    content_hash varchar(64) not null, original_content clob not null,
    imported_at timestamp with time zone not null, unique(source_path, content_hash)
);
create table if not exists knowledge_draft (
    id varchar(36) primary key, source_document_id varchar(36) not null references knowledge_source(id),
    kind varchar(20) not null, title varchar(500) not null, summary clob not null, source_excerpt clob not null,
    source_line_start integer not null, source_line_end integer not null, status varchar(20) not null,
    extraction_method varchar(20) not null,
    approved_by varchar(100), reviewed_at timestamp with time zone,
    rule_conditions clob not null default '[]',
    rule_action varchar(20) not null default 'WAIT',
    strategy_mode varchar(40) not null default 'BASE_GRANVILLE',
    timeframe varchar(50) not null default '日线',
    priority integer not null default 50,
    evidence_ids clob not null default '[]',
    invalidation_conditions clob not null default '[]',
    strength varchar(20) not null default 'UNSPECIFIED'
);
create table if not exists published_rule_source (
    id varchar(36) primary key, source_document_id varchar(36) not null references knowledge_source(id),
    name varchar(500) not null, description clob not null, source_excerpt clob not null,
    source_line_start integer not null, source_line_end integer not null, approved_by varchar(100) not null,
    published_at timestamp with time zone not null,
    enabled boolean not null default true,
    rule_conditions clob not null default '[]',
    rule_action varchar(20) not null default 'WAIT',
    strategy_mode varchar(40) not null default 'BASE_GRANVILLE',
    timeframe varchar(50) not null default '日线',
    priority integer not null default 50,
    evidence_ids clob not null default '[]',
    invalidation_conditions clob not null default '[]',
    strength varchar(20) not null default 'UNSPECIFIED'
);

create table if not exists admin_job (
    id varchar(36) primary key,
    type varchar(40) not null,
    target varchar(180) not null,
    status varchar(20) not null,
    attempts integer not null default 0,
    error varchar(2000),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create table if not exists audit_event (
    id varchar(36) primary key,
    actor_id varchar(100),
    action varchar(80) not null,
    target varchar(180) not null,
    evidence varchar(10000) not null,
    created_at timestamp with time zone not null default current_timestamp
);

create table if not exists ai_call_log (
    id varchar(36) primary key,
    actor_id varchar(100),
    purpose varchar(80) not null,
    model varchar(100) not null,
    status varchar(20) not null,
    created_at timestamp with time zone not null default current_timestamp
);

create table if not exists account_trade (
    id varchar(180) not null,
    user_id varchar(100) not null,
    symbol varchar(32) not null,
    side varchar(10) not null,
    quantity decimal(20, 6) not null,
    price decimal(20, 6) not null,
    fee decimal(20, 6) not null default 0,
    traded_at timestamp with time zone not null,
    note varchar(2000),
    revision bigint not null,
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp,
    primary key (user_id, id)
);

create table if not exists scenario_forecast_record (
    id varchar(36) primary key,
    owner_id varchar(140) not null,
    client_record_id varchar(180) not null,
    client_version integer not null check (client_version > 0),
    previous_record_id varchar(36) references scenario_forecast_record(id),
    symbol varchar(6) not null,
    kind varchar(20) not null,
    received_at timestamp with time zone not null,
    client_created_at timestamp with time zone not null,
    input_as_of timestamp with time zone not null,
    anchor_day date not null,
    method varchar(40) not null,
    definition_version varchar(100) not null,
    target_policy varchar(80) not null,
    payload_hash varchar(64) not null,
    payload_text text not null,
    next_check_at timestamp with time zone,
    claim_until timestamp with time zone,
    retry_count integer not null default 0,
    first_success_at timestamp with time zone,
    recheck_until timestamp with time zone,
    unique(owner_id,client_record_id,client_version)
);
create index if not exists scenario_forecast_owner_time on scenario_forecast_record(owner_id,received_at desc,id desc);
create index if not exists scenario_forecast_symbol_time on scenario_forecast_record(owner_id,symbol,received_at desc,id desc);
create index if not exists scenario_forecast_due on scenario_forecast_record(next_check_at,claim_until);

create table if not exists scenario_price_evaluation (
    id varchar(36) primary key,
    forecast_id varchar(36) not null references scenario_forecast_record(id),
    evaluation_version integer not null,
    previous_evaluation_id varchar(36) references scenario_price_evaluation(id),
    score_evaluation_id varchar(36) references scenario_price_evaluation(id),
    target_resolution_version integer not null,
    target_resolution_state varchar(30) not null,
    target_day date,
    resolution_evidence text not null,
    actual_candle_hash varchar(64),
    raw_response_hash varchar(64),
    actual_fetched_at timestamp with time zone,
    evaluated_at timestamp with time zone not null,
    definition_version varchar(100) not null,
    forward_eligible boolean not null,
    status varchar(30) not null,
    next_retry_at timestamp with time zone,
    total_levels integer,
    close_levels integer,
    covered_targets integer,
    payload_text text not null,
    unique(forecast_id,evaluation_version),
    unique(forecast_id,target_resolution_version,actual_candle_hash,definition_version)
);
create index if not exists scenario_evaluation_history on scenario_price_evaluation(forecast_id,evaluation_version desc);
create index if not exists scenario_evaluation_cohort on scenario_price_evaluation(forecast_id,evaluated_at desc,target_resolution_version);

create table if not exists note_study_revision (
    id varchar(36) primary key,
    owner_id varchar(140) not null,
    source_file varchar(1000) not null,
    source_hash varchar(64) not null,
    source_text text not null,
    source_url text not null,
    channel varchar(40) not null,
    parent_revision_id varchar(36) references note_study_revision(id),
    created_at timestamp with time zone not null,
    tag_ids text not null,
    legacy_record_id varchar(180),
    legacy_level varchar(20),
    legacy_tag_version integer,
    study_payload_hash varchar(64) not null,
    study_payload_text text not null,
    unique(owner_id,study_payload_hash),
    unique(owner_id,channel,legacy_record_id,legacy_level,source_hash,legacy_tag_version)
);
create index if not exists note_study_file_versions on note_study_revision(owner_id,source_file,created_at desc,id desc);
