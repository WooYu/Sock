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
