create table admin_job (
    id uuid primary key,
    type varchar(40) not null,
    target varchar(180) not null,
    status varchar(20) not null,
    attempts integer not null default 0,
    error varchar(2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table ai_call_log (
    id uuid primary key,
    actor_id uuid,
    purpose varchar(80) not null,
    model varchar(100) not null,
    status varchar(20) not null,
    created_at timestamptz not null default now()
);
