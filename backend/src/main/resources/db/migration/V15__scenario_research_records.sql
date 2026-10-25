create table scenario_forecast_record (
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
create index scenario_forecast_owner_time on scenario_forecast_record(owner_id,received_at desc,id desc);
create index scenario_forecast_symbol_time on scenario_forecast_record(owner_id,symbol,received_at desc,id desc);
create index scenario_forecast_due on scenario_forecast_record(next_check_at,claim_until);

create table scenario_price_evaluation (
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
create index scenario_evaluation_history on scenario_price_evaluation(forecast_id,evaluation_version desc);
create index scenario_evaluation_cohort on scenario_price_evaluation(forecast_id,evaluated_at desc,target_resolution_version);

create table note_study_revision (
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
create index note_study_file_versions on note_study_revision(owner_id,source_file,created_at desc,id desc);
