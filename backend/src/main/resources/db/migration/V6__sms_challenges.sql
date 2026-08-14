create table sms_challenge (
    phone varchar(20) primary key,
    code_hash varchar(128) not null,
    expires_at timestamptz not null,
    requested_at timestamptz not null,
    attempts integer not null default 0,
    consumed_at timestamptz
);
