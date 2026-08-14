create table sync_change (
    cursor bigint generated always as identity primary key,
    user_id varchar(100) not null,
    idempotency_key varchar(180) not null,
    entity_type varchar(50) not null,
    entity_id varchar(180) not null,
    operation varchar(30) not null,
    revision bigint not null,
    payload jsonb not null,
    changed_at timestamptz not null default now(),
    unique (user_id, idempotency_key)
);

create index sync_change_user_cursor_idx on sync_change(user_id, cursor);
create index sync_change_entity_revision_idx
    on sync_change(user_id, entity_type, entity_id, revision desc);
