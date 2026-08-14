create table access_token (
    token_hash varchar(128) primary key,
    phone varchar(20) not null,
    expires_at timestamptz not null
);

create index access_token_expires_idx on access_token(expires_at);
