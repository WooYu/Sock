create table app_user (
    id uuid primary key,
    phone varchar(20) not null unique,
    display_name varchar(100) not null,
    role varchar(20) not null default 'USER',
    enabled boolean not null default true,
    created_at timestamptz not null default now()
);

create table device_session (
    id uuid primary key,
    user_id uuid not null references app_user(id),
    device_name varchar(120) not null,
    refresh_token_hash varchar(128) not null unique,
    last_seen_at timestamptz not null,
    revoked_at timestamptz
);

create table sync_mutation (
    id uuid primary key,
    user_id uuid not null references app_user(id),
    idempotency_key varchar(180) not null unique,
    entity_type varchar(50) not null,
    operation varchar(30) not null,
    payload jsonb not null,
    revision bigint not null,
    created_at timestamptz not null
);

create table audit_event (
    id uuid primary key,
    actor_id uuid,
    action varchar(80) not null,
    target varchar(180) not null,
    evidence jsonb not null,
    created_at timestamptz not null default now()
);
