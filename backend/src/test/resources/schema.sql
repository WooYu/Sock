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
    approved_by varchar(100), reviewed_at timestamp with time zone
);
create table if not exists published_rule_source (
    id varchar(36) primary key, source_document_id varchar(36) not null references knowledge_source(id),
    name varchar(500) not null, description clob not null, source_excerpt clob not null,
    source_line_start integer not null, source_line_end integer not null, approved_by varchar(100) not null,
    published_at timestamp with time zone not null
);
