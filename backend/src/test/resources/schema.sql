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
